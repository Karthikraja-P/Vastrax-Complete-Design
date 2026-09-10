import asyncio
import logging
from contextlib import asynccontextmanager

logger = logging.getLogger("vastrax.gpu_queue")


class GPUQueueManager:
    """
    Global FIFO GPU Execution Queue for AI Virtual Try-On and 3D Neural Reconstruction.
    Enforces concurrency=1 to protect GPU VRAM (16GB) from CUDA OOM and race conditions.
    """

    def __init__(self, max_concurrent: int = 1) -> None:
        self._max_concurrent = max_concurrent
        self._semaphore: asyncio.Semaphore | None = None
        self._waiting_count: int = 0
        self._active_count: int = 0

    @property
    def semaphore(self) -> asyncio.Semaphore:
        if self._semaphore is None:
            self._semaphore = asyncio.Semaphore(self._max_concurrent)
        return self._semaphore

    @property
    def queue_depth(self) -> int:
        """Number of jobs currently waiting in line."""
        return self._waiting_count

    @property
    def active_jobs(self) -> int:
        """Number of jobs currently executing on the GPU."""
        return self._active_count

    @asynccontextmanager
    async def acquire(self, job_name: str = "ai_task"):
        """Context manager to wait in line and acquire the GPU cleanly."""
        self._waiting_count += 1
        pos = self._waiting_count
        logger.info(
            "Job [%s] queued. Position in line: %d (Active GPU jobs: %d)",
            job_name,
            pos,
            self._active_count,
        )

        try:
            async with self.semaphore:
                self._waiting_count -= 1
                self._active_count += 1
                logger.info(
                    "Job [%s] acquired GPU. Processing started... (Remaining in queue: %d)",
                    job_name,
                    self._waiting_count,
                )
                try:
                    yield
                finally:
                    self._active_count -= 1
                    logger.info(
                        "Job [%s] finished GPU execution. GPU released. (Active: %d, Queue: %d)",
                        job_name,
                        self._active_count,
                        self._waiting_count,
                    )
        except Exception:
            if self._waiting_count > 0 and self._active_count == 0:
                self._waiting_count -= 1
            raise


# Global singleton queue instance for the entire application
gpu_queue = GPUQueueManager(max_concurrent=1)
