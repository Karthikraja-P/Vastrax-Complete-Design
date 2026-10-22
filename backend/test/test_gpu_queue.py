import asyncio

import pytest
from fastapi import HTTPException

from app.core import gpu_queue as gq


def run(coro):
    return asyncio.run(coro)


def test_serial_and_tryon_before_3d():
    async def main():
        q = gq.GPUQueueManager()
        order, running = [], 0

        async def job(name, hold=0.05):
            nonlocal running
            async with q.acquire(name):
                running += 1
                assert running == 1  # never two jobs on the GPU
                order.append(name)
                await asyncio.sleep(hold)
                running -= 1

        first = asyncio.create_task(job("3d_first", 0.2))
        await asyncio.sleep(0.02)
        rest = [asyncio.create_task(job(n)) for n in ("3d_second", "tryon_a", "tryon_b")]
        await asyncio.gather(first, *rest)
        return order

    assert run(main()) == ["3d_first", "tryon_a", "tryon_b", "3d_second"]


def test_queued_tryon_always_precedes_older_3d_job():
    async def main():
        q = gq.GPUQueueManager()
        order = []

        async def job(name, hold):
            async with q.acquire(name):
                order.append(name)
                await asyncio.sleep(hold)

        holder = asyncio.create_task(job("tryon_hold", 0.15))
        await asyncio.sleep(0.01)
        old3d = asyncio.create_task(job("3d_old", 0.01))
        await asyncio.sleep(0.08)
        fresh = asyncio.create_task(job("tryon_fresh", 0.01))
        await asyncio.gather(holder, old3d, fresh)
        return order

    order = run(main())
    assert order == ["tryon_hold", "tryon_fresh", "3d_old"]


def test_queue_snapshot_reports_3d_deferred_for_tryon():
    async def main():
        q = gq.GPUQueueManager()
        entered = asyncio.Event()
        release = asyncio.Event()

        async def hold():
            async with q.acquire("tryon_active"):
                entered.set()
                await release.wait()

        active = asyncio.create_task(hold())
        await entered.wait()
        three_d = asyncio.create_task(_acquire_and_release(q, "3d_admin"))
        tryon = asyncio.create_task(_acquire_and_release(q, "tryon_customer"))
        await asyncio.sleep(0)
        snapshot = q.snapshot()
        release.set()
        await asyncio.gather(active, three_d, tryon)
        return snapshot

    snapshot = run(main())
    assert snapshot["tryon_waiting"] == 1
    assert snapshot["tryon_active"] is True
    assert snapshot["three_d_waiting"] == 1
    assert snapshot["three_d_deferred_by_tryon"] is True


async def _acquire_and_release(q, name):
    async with q.acquire(name):
        pass

def test_cancelled_waiter_does_not_leak_slot():
    async def main():
        q = gq.GPUQueueManager()

        async def hold():
            async with q.acquire("tryon_hold"):
                await asyncio.sleep(0.1)

        async def waiter():
            async with q.acquire("tryon_waiter"):
                pass

        h = asyncio.create_task(hold())
        await asyncio.sleep(0.01)
        w = asyncio.create_task(waiter())
        await asyncio.sleep(0.01)
        assert q.queue_depth == 1
        w.cancel()
        await asyncio.gather(h, w, return_exceptions=True)
        assert q.queue_depth == 0 and q.active_jobs == 0
        async with q.acquire("tryon_after"):  # queue still usable
            assert q.active_jobs == 1

    run(main())


def test_failed_job_releases_gpu():
    async def main():
        q = gq.GPUQueueManager()
        with pytest.raises(RuntimeError):
            async with q.acquire("tryon_boom"):
                raise RuntimeError("gpu error")
        assert q.active_jobs == 0
        async with q.acquire("tryon_ok"):
            pass

    run(main())


def test_full_queue_returns_429(monkeypatch):
    monkeypatch.setattr(gq, "MAX_QUEUE", 1)

    async def main():
        q = gq.GPUQueueManager()

        async def hold(name):
            async with q.acquire(name):
                await asyncio.sleep(0.1)

        a = asyncio.create_task(hold("tryon_a"))
        await asyncio.sleep(0.01)
        b = asyncio.create_task(hold("tryon_b"))
        await asyncio.sleep(0.01)
        with pytest.raises(HTTPException) as e:
            async with q.acquire("tryon_c"):
                pass
        assert e.value.status_code == 429
        await asyncio.gather(a, b)

    run(main())


def test_wait_timeout_returns_503(monkeypatch):
    monkeypatch.setattr(gq, "MAX_WAIT_SECONDS", 0.05)

    async def main():
        q = gq.GPUQueueManager()

        async def hold():
            async with q.acquire("tryon_hold"):
                await asyncio.sleep(0.2)

        h = asyncio.create_task(hold())
        await asyncio.sleep(0.01)
        with pytest.raises(HTTPException) as e:
            async with q.acquire("tryon_late"):
                pass
        assert e.value.status_code == 503 and q.queue_depth == 0
        await h

    run(main())
