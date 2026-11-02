import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { getHotelData, setRoomReference, type ReferenceRecord } from "./hotel-data";
import { saveRawPhoto } from "./photos";
import aiData from "./demo-ai-data.json";

export interface DemoSamplePhoto { id: string; label: string; file: string }

export const DEMO_SAMPLE_PHOTOS: DemoSamplePhoto[] = [
  { id: "matching", label: "Sample: matching", file: "sample-matching.jpg" },
  { id: "towels-missing", label: "Sample: towels missing", file: "sample-towels-missing.jpg" },
  { id: "bed-not-made", label: "Sample: bed not made", file: "sample-bed-not-made.jpg" },
];

export const DEMO_PERFECT_PHOTOS = [
  { file: "room-perfect-bed.jpg", label: "Bed area" as const, name: "demo-ref-bed.jpg" },
  { file: "room-perfect-bathroom.jpg", label: "Bathroom" as const, name: "demo-ref-bathroom.jpg" },
];

export function demoAiReference(): { items: ReferenceRecord["items"]; itemSource: ReferenceRecord["itemSource"]; model: string } | null {
  const ref = (aiData as unknown as { reference?: { items?: ReferenceRecord["items"]; itemSource?: string; model?: string } | null }).reference;
  if (!ref?.items?.length) return null;
  return { items: ref.items, itemSource: ref.itemSource === "vision" ? "vision" : "broad", model: ref.model ?? "sam-3.1" };
}

export async function readDemoPhoto(file: string): Promise<Buffer> {
  return fs.readFile(path.join(process.cwd(), "public/demo", file));
}

/** Seed perfect photos + precomputed AI result for rooms 204/205. No AI calls. */
export async function seedDemoPerfectPhotos(): Promise<number> {
  const ref = demoAiReference();
  if (!ref) return 0;
  const photos = [];
  for (const p of DEMO_PERFECT_PHOTOS) {
    const saved = await saveRawPhoto(p.name, await readDemoPhoto(p.file));
    photos.push({ ...saved, label: p.label });
  }
  const data = await getHotelData();
  let seeded = 0;
  for (const number of ["204", "205"]) {
    const room = data.rooms.find((r) => r.number === number);
    if (!room) continue;
    const record: ReferenceRecord = {
      id: randomUUID(), photos, items: ref.items, itemSource: ref.itemSource,
      checkedAt: new Date().toISOString(), uploadedBy: "Hotel setup", uploadedByRole: "Owner",
      uploadedAt: new Date().toISOString(), reason: null, copiedFromRoom: null,
    };
    if (await setRoomReference(room.id, record)) seeded += 1;
  }
  return seeded;
}
