const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

export interface Playlist {
  id: number
  youtube_playlist_id: string
  title: string
  is_default: boolean
  last_synced_at: string | null
  video_count: number
}

export interface Video {
  id: number
  youtube_video_id: string
  playlist_id: number
  position: number
  title: string
  description: string
  duration_seconds: number
  thumbnail_url: string
  tags: string[]
  transcript_status: 'pending' | 'ok' | 'unavailable'
  moments: VideoMoment[]
}

export interface VideoMoment {
  id: number
  video_id: number
  position_seconds: number
  label: string
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    ...options,
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || `Erro HTTP ${response.status}`)
  }
  if (response.status === 204) {
    return undefined as T
  }
  return response.json() as Promise<T>
}

export const api = {
  health: () => request<{ status: string }>('/health'),
  listPlaylists: () => request<Playlist[]>('/playlists'),
  createPlaylist: (url_or_id: string) =>
    request<Playlist>('/playlists', {
      method: 'POST',
      body: JSON.stringify({ url_or_id }),
    }),
  getPlaylist: (id: number) => request<Playlist>(`/playlists/${id}`),
  syncPlaylist: (id: number) =>
    request<Playlist>(`/playlists/${id}/sync`, { method: 'POST' }),
  listVideos: (playlistId: number, q?: string) => {
    const params = q ? `?q=${encodeURIComponent(q)}` : ''
    return request<Video[]>(`/playlists/${playlistId}/videos${params}`)
  },
  addVideoMoment: (videoId: number, position_seconds: number, label = '') =>
    request<VideoMoment>(`/videos/${videoId}/moments`, {
      method: 'POST',
      body: JSON.stringify({ position_seconds, label }),
    }),
  deleteVideoMoment: (videoId: number, momentId: number) =>
    request<void>(`/videos/${videoId}/moments/${momentId}`, { method: 'DELETE' }),
  seedTestData: () => request<{ playlist_id: number; seed_term: string }>('/test/seed', { method: 'POST' }),
}
