"""Priority GPU job queue: one job on the GPU at a time (16 GB VRAM), interactive try-on ahead of long 3D jobs."""
import asyncio
import logging
import os
import time
from contextlib import asynccontextmanager

from fastapi import HTTPException

logger = logging.getLogger("vastrax.gpu_queue")

PRIORITY_TRYON = 0  # short, user-facing
PRIORITY_3D = 10  # long admin jobs
MAX_QUEUE = int(os.getenv("GPU_QUEUE_MAX", "20"))
MAX_WAIT_SECONDS = float(os.getenv("GPU_QUEUE_MAX_WAIT_SECONDS", "1800"))


class _Ticket:
    __slots__ = ("name", "priority", "enqueued", "started", "future")

    def __init__(self, name: str, priority: int) -> None:
        self.name = name
        self.priority = priority
        self.enqueued = time.monotonic()
        self.started: float | None = None
        self.future: asyncio.Future = asyncio.get_running_loop().create_future()


def priority_for(job_name: str) -> int:
    return PRIORITY_3D if job_name.startswith("3d") else PRIORITY_TRYON


class GPUQueueManager:
    def __init__(self) -> None:
        self._waiting: list[_Ticket] = []
        self._active: _Ticket | None = None

    def _rank(self, t: _Ticket) -> tuple[int, float]:
        # Strict priority: an admin 3D job must never overtake a queued shopper try-on.
        return (t.priority, t.enqueued)

    @property
    def queue_depth(self) -> int:
        return len(self._waiting)

    @property
    def active_jobs(self) -> int:
        return 1 if self._active else 0

    def _grant_next(self) -> None:
        while self._active is None and self._waiting:
            now = time.monotonic()
            nxt = min(self._waiting, key=self._rank)
            self._waiting.remove(nxt)
            if nxt.future.done():  # cancelled while waiting
                continue
            self._active = nxt
            nxt.started = now
            nxt.future.set_result(None)
            logger.info("GPU granted to [%s] after %.1fs (queue: %d)", nxt.name, now - nxt.enqueued, len(self._waiting))

    def _release(self, t: _Ticket) -> None:
        if self._active is t:
            self._active = None
            logger.info("GPU released by [%s] after %.1fs", t.name, time.monotonic() - (t.started or t.enqueued))
            self._grant_next()

    @asynccontextmanager
    async def acquire(self, job_name: str = "ai_task", priority: int | None = None):
        if len(self._waiting) >= MAX_QUEUE:
            raise HTTPException(status_code=429, detail="GPU queue is full, please try again shortly")
        t = _Ticket(job_name, priority_for(job_name) if priority is None else priority)
        self._waiting.append(t)
        logger.info("GPU job [%s] queued (position %d)", job_name, len(self._waiting))
        self._grant_next()
        try:
            await asyncio.wait_for(t.future, timeout=MAX_WAIT_SECONDS)
        except BaseException as exc:  # timeout or client disconnect: never leak a slot
            if self._active is t:
                self._release(t)
            elif t in self._waiting:
                self._waiting.remove(t)
            if isinstance(exc, asyncio.TimeoutError):
                raise HTTPException(status_code=503, detail="Timed out waiting for the GPU queue") from exc
            raise
        try:
            yield
        finally:
            self._release(t)

    def snapshot(self) -> dict:
        now = time.monotonic()
        a = self._active
        queued = sorted(self._waiting, key=self._rank)
        tryon_waiting = sum(t.priority == PRIORITY_TRYON for t in queued)
        three_d_waiting = sum(t.priority == PRIORITY_3D for t in queued)
        return {
            "active": {"job": a.name, "running_seconds": round(now - (a.started or now))} if a else None,
            "depth": len(queued),
            "tryon_waiting": tryon_waiting,
            "three_d_waiting": three_d_waiting,
            "three_d_deferred_by_tryon": three_d_waiting > 0 and tryon_waiting > 0,
            "queued": [
                {"job": t.name, "priority": t.priority, "waiting_seconds": round(now - t.enqueued)}
                for t in queued
            ],
        }


gpu_queue = GPUQueueManager()
