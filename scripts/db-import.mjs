#!/usr/bin/env node
/**
 * One-time import (M2 / ANT-18): copy the local .data files (including
 * photos) into Supabase. Run:  npm run db:import
 *
 * Reads DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and
 * SUPABASE_PHOTOS_BUCKET (default "task-photos") from the environment /
 * .env.local — values are never printed. Safe to run twice: documents are
 * upserted under the same keys, AI usage rows are set (not added), and
 * photo uploads overwrite the same object names, so nothing duplicates.
 * The local .data folder is only read, never changed.
 */
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(root, ".data");

async function loadEnvLocal() {
  try {
    const text = await fs.readFile(path.join(root, ".env.local"), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^([A-Z_]+)=(.*)$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
    }
  } catch { /* no .env.local: environment variables alone are fine */ }
}

async function readJson(name, fallback) {
  try { return JSON.parse(await fs.readFile(path.join(DATA_DIR, name), "utf8")); }
  catch { return fallback; }
}

async function main() {
  await loadEnvLocal();
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set (in .env.local or the environment). Nothing imported.");
    process.exit(1);
  }
  // TLS like the app (Supabase pooler requires it); ?sslmode=disable in the
  // URL opts out for a local test database.
  let useSsl = true;
  try { if (new URL(databaseUrl).searchParams.get("sslmode") === "disable") useSsl = false; } catch { /* keep TLS */ }
  const client = new pg.Client({ connectionString: databaseUrl, ssl: useSsl ? { rejectUnauthorized: false } : false });
  await client.connect();
  try {
    const docs = [
      ["tasks", "tasks.json", []],
      ["history", "history.json", []],
      ["reports", "reports.json", []],
      ["hotel", "hotel.json", null],
      ["employees", "employees.json", []],
      ["bookings", "bookings.json", []],
      ["conversations", "conversations.json", []],
    ];
    for (const [key, file, fallback] of docs) {
      const data = await readJson(file, fallback);
      if (data === null || data === undefined) { console.log(`- ${key}: no local file, skipped`); continue; }
      await client.query(
        `INSERT INTO app_documents (key, data, updated_at) VALUES ($1, $2::jsonb, now())
         ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
        [key, JSON.stringify(data)],
      );
      const label = Array.isArray(data) ? `${data.length} item(s)` : "1 document";
      console.log(`- ${key}: imported ${label} from .data/${file}`);
    }
    // AI usage: SET the counts from the file (never add), so a second run
    // leaves exactly the same numbers.
    const usage = await readJson("ai-usage.json", {});
    let usageRows = 0;
    for (const [day, bucket] of Object.entries(usage ?? {})) {
      for (const [kind, count] of Object.entries(bucket ?? {})) {
        if (typeof count !== "number") continue;
        await client.query(
          `INSERT INTO ai_usage_daily (day, kind, count) VALUES ($1, $2, $3)
           ON CONFLICT (day, kind) DO UPDATE SET count = EXCLUDED.count`,
          [day, kind, count],
        );
        usageRows += 1;
      }
    }
    console.log(`- ai usage: ${usageRows} day/kind row(s) set`);
  } finally {
    await client.end();
  }

  // Photos -> private Supabase Storage bucket (same object names, upsert).
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = process.env.SUPABASE_PHOTOS_BUCKET?.trim() || "task-photos";
  if (!supabaseUrl || !serviceKey) {
    console.log("- photos: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set, photos skipped (database data imported).");
    return;
  }
  let names = [];
  try { names = await fs.readdir(path.join(DATA_DIR, "photos")); } catch { /* no photos yet */ }
  let uploaded = 0;
  for (const name of names) {
    const bytes = await fs.readFile(path.join(DATA_DIR, "photos", name));
    const ext = path.extname(name).toLowerCase();
    const contentType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
    const response = await fetch(`${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/${bucket}/${encodeURIComponent(name)}`, {
      method: "POST",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": contentType, "x-upsert": "true" },
      body: bytes,
    });
    if (!response.ok) throw new Error(`Photo upload failed for ${name} (HTTP ${response.status}). Is the private bucket "${bucket}" created? Run supabase/schema.sql first.`);
    uploaded += 1;
  }
  console.log(`- photos: ${uploaded} file(s) uploaded to private bucket "${bucket}"`);
  console.log("Import done. Running it again is safe: no duplicates are created.");
}

main().catch((error) => {
  console.error("Import failed:", error instanceof Error ? error.message : "unknown error");
  process.exit(1);
});
