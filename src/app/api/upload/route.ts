import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { writeFile } from "fs/promises";
import { randomUUID } from "crypto";
import path from "path";

const MAX_GLB_BYTES = 50 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return NextResponse.json({ success: false, error: "Upload service unavailable" }, { status: 503 });
  }

  const session = await getToken({ req: request, secret });
  const backendToken = session?.accessToken;
  if (!session || typeof backendToken !== "string") {
    return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  }

  try {
    const backendBase = process.env.INTERNAL_BACKEND_URL || "http://backend:8090";
    const auth = await fetch(`${backendBase}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${backendToken}` },
      cache: "no-store",
    });
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
    }
    const user = await auth.json();
    if (String(user.role).toLowerCase() !== "admin") {
      return NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 });
    }

    const data = await request.formData();
    const file = data.get("file");
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".glb") || file.size < 12 || file.size > MAX_GLB_BYTES) {
      return NextResponse.json({ success: false, error: "A GLB file up to 50 MB is required" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.toString("ascii", 0, 4) !== "glTF" || buffer.readUInt32LE(4) !== 2 || buffer.readUInt32LE(8) !== buffer.length) {
      return NextResponse.json({ success: false, error: "Invalid GLB file" }, { status: 400 });
    }

    const filename = `${randomUUID()}.glb`;
    const uploadDir = path.join(process.cwd(), "public", "models", "3d");
    await writeFile(path.join(uploadDir, filename), buffer, { flag: "wx" });
    return NextResponse.json({ success: true, url: `/models/3d/${filename}` });
  } catch (error) {
    console.error("3D upload failed:", error);
    return NextResponse.json({ success: false, error: "Upload failed" }, { status: 500 });
  }
}
