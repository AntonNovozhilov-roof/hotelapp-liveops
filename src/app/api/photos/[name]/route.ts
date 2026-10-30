import { NextResponse } from "next/server";
import { readPhoto } from "@/lib/photos";

/** Serve one saved task photo. Reading goes through src/lib/photos.ts only. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const photo = await readPhoto(name);
  if (!photo) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(photo.bytes), {
    headers: {
      "Content-Type": photo.contentType,
      "Content-Length": String(photo.bytes.length),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
