import { NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";

export async function POST(request: Request) {
  try {
    const data = await request.formData();
    const file: File | null = data.get("file") as unknown as File;

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Save to public/models/3d
    const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-]/g, "_")}`;
    const uploadDir = path.join(process.cwd(), "public/models/3d");
    const filepath = path.join(uploadDir, filename);

    await writeFile(filepath, buffer);

    const publicPath = `/models/3d/${filename}`;

    return NextResponse.json({ success: true, url: publicPath });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
