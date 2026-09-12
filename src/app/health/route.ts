import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const backendBase = process.env.INTERNAL_BACKEND_URL || "http://backend:8090";
  const targets = [
    backendBase,
    "http://backend:8090",
    "http://127.0.0.1:8090",
    "http://localhost:8090",
  ];

  for (const base of targets) {
    try {
      const cleanBase = base.replace(/\/+$/, "");
      const res = await fetch(`${cleanBase}/health`, {
        cache: "no-store",
        signal: AbortSignal.timeout(2500),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({ status: "ok" }));
        return NextResponse.json(data, {
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        });
      }
    } catch {}
  }

  return NextResponse.json(
    { status: "down", error: "Backend unreachable" },
    { status: 502 }
  );
}
