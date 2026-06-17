import fs from "node:fs/promises"
import { getSupabase } from "./supabase"

const VIDEOS_BUCKET = process.env.SUPABASE_VIDEOS_BUCKET || "intervention-videos"

export async function uploadVideoToStorage(opts: {
  filePath: string
  storagePath: string
}): Promise<string> {
  const sb = getSupabase()
  const buffer = await fs.readFile(opts.filePath)
  const { error } = await sb.storage.from(VIDEOS_BUCKET).upload(opts.storagePath, buffer, {
    contentType: "video/mp4",
    upsert: true,
  })
  if (error) throw new Error(`Storage upload failed: ${error.message}`)
  const { data } = sb.storage.from(VIDEOS_BUCKET).getPublicUrl(opts.storagePath)
  if (!data?.publicUrl) throw new Error("Storage publicUrl unavailable")
  return data.publicUrl
}
