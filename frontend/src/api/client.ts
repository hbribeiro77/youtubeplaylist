const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

export interface Playlist {
  id: number
  youtube_playlist_id: string
  title: string
  channel_name: string
  is_default: boolean
  last_synced_at: string | null
  video_count: number
  new_video_count: number
}

export interface PlaylistSyncResult extends Playlist {
  new_videos_added: number
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
  replay_enabled: boolean
  replay_duration_seconds: number
  loop_enabled: boolean
  loop_count: number
  is_new: boolean
  published_at: string | null
  moments: VideoMoment[]
}

export const REPLAY_DURATION_OPTIONS = [5, 10, 15, 20, 25, 30] as const

export const LOOP_COUNT_OPTIONS = [
  { value: 0, label: 'Não' },
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
  { value: 5, label: '5' },
  { value: -1, label: '∞' },
] as const

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
    request<PlaylistSyncResult>('/playlists', {
      method: 'POST',
      body: JSON.stringify({ url_or_id }),
    }),
  getPlaylist: (id: number) => request<Playlist>(`/playlists/${id}`),
  syncPlaylist: (id: number) =>
    request<PlaylistSyncResult>(`/playlists/${id}/sync`, { method: 'POST' }),
  deletePlaylist: (id: number) =>
    request<void>(`/playlists/${id}`, { method: 'DELETE' }),
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
  updateVideoReplay: (
    videoId: number,
    payload: {
      replay_enabled?: boolean
      replay_duration_seconds?: number
      loop_enabled?: boolean
      loop_count?: number
    },
  ) =>
    request<Video>(`/videos/${videoId}/replay`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  acknowledgeNewVideo: (videoId: number) =>
    request<Video>(`/videos/${videoId}/acknowledge-new`, { method: 'PATCH' }),
  acknowledgeAllNewVideos: () =>
    request<{ cleared_count: number }>('/playlists/acknowledge-all-new', { method: 'POST' }),
  seedTestData: () => request<{ playlist_id: number; seed_term: string }>('/test/seed', { method: 'POST' }),
}
