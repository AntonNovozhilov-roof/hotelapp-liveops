import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { restoreSecretMatches } from "@/lib/restore";
import { compareWithReference, demoDataUrlHash, exportDemoPhotoCache, fuseWithSpark, runReferenceCheck, runSecondOpinion } from "@/lib/photo-check";
import { DEMO_PERFECT_PHOTOS, DEMO_SAMPLE_PHOTOS, readDemoPhoto } from "@/lib/demo-photos";

export const maxDuration = 60;

/** One-time generator for the bundled demo AI data. Secret-gated like restore. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { code?: string } | null;
  if (!restoreSecretMatches(body?.code)) return NextResponse.json({ error: "Wrong code." }, { status: 403 });
  const dataUrl = async (file: string) => `data:image/jpeg;base64,${(await readDemoPhoto(file)).toString("base64")}`;
  const perfectUrls = await Promise.all(DEMO_PERFECT_PHOTOS.map((p) => dataUrl(p.file)));
  const reference = await runReferenceCheck(perfectUrls);
  const variants: Record<string, unknown> = {};
  for (const sample of DEMO_SAMPLE_PHOTOS) {
    const url = await dataUrl(sample.file);
    const base = await compareWithReference([url], reference.items);
    const spark = await runSecondOpinion(perfectUrls, [url]);
    variants[demoDataUrlHash(url)] = fuseWithSpark(base, spark);
  }
  const aiData = { reference: { items: reference.items, itemSource: reference.itemSource, model: reference.model }, variants };
  const cache = exportDemoPhotoCache();
  await fs.writeFile(path.join(process.cwd(), "src/lib/demo-ai-data.json"), `${JSON.stringify(aiData, null, 2)}\n`);
  await fs.writeFile(path.join(process.cwd(), "src/lib/demo-photo-cache.json"), `${JSON.stringify(cache, null, 2)}\n`);
  return NextResponse.json({ ok: true, referenceItems: reference.items.length, itemSource: reference.itemSource, variants: Object.keys(variants).length, samCache: Object.keys(cache.sam).length, sparkCache: Object.keys(cache.spark).length });
}
