import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ filename: string[] }> }
) {
  const { filename } = await context.params;
  const safeName = filename.join("/");
  
  // Prevent directory traversal
  if (safeName.includes("..")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const filePath = path.join(process.cwd(), "public", "models", "3d", ...filename);

  if (!fs.existsSync(filePath)) {
    return new NextResponse("Model Not Found", { status: 404 });
  }

  const fileBuffer = fs.readFileSync(filePath);

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": "model/gltf-binary",
      "Content-Length": fileBuffer.length.toString(),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
