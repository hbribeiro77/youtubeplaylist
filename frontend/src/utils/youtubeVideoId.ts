/** YouTube video IDs têm exatamente 11 caracteres alfanuméricos, _ ou -. */
const YOUTUBE_VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/

export function isValidYouTubeVideoId(id: string | null | undefined): id is string {
  if (!id) return false
  return YOUTUBE_VIDEO_ID_RE.test(id.trim())
}

export function normalizeYouTubeVideoId(id: string | null | undefined): string | null {
  if (!id) return null
  const trimmed = id.trim()
  return isValidYouTubeVideoId(trimmed) ? trimmed : null
}
