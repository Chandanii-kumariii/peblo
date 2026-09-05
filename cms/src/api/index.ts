import axios from 'axios'
import type { Show, Season, Episode } from '../types'

export const API_URL = import.meta.env.VITE_API_URL ?? `${window.location.protocol}//${window.location.hostname}:8000`

const API = axios.create({
  baseURL: `${API_URL}/admin`,
})

API.interceptors.request.use(config => {
  config.headers['x-user-role'] = 'editor'
  return config
})

// Shows
export const getShows = () => API.get<Show[]>('/shows').then(res => res.data)
export const getShow = (id: string) => API.get<Show>(`/shows/${id}`).then(res => res.data)
export const updateShow = (id: string, data: Partial<Show>) => API.put<Show>(`/shows/${id}`, data).then(res => res.data) // NOTE: Backend doesn't have PUT yet, might need to implement or just mock for now

// Seasons
export const getSeasons = (showId: string) => API.get<Season[]>(`/shows/${showId}/seasons`).then(res => res.data)
export const createSeason = (data: Omit<Season, 'id'>) => API.post<Season>('/seasons', data).then(res => res.data)

// Episodes
export const getEpisodes = (seasonId: string) => API.get<Episode[]>(`/seasons/${seasonId}/episodes`).then(res => res.data)
export const createEpisode = (data: Omit<Episode, 'id'>) => API.post<Episode>('/episodes', data).then(res => res.data)

// Artwork
export const uploadArtwork = (episodeId: string, type: 'poster' | 'banner' | 'thumbnail', file: File) => {
  const formData = new FormData()
  formData.append('episode_id', episodeId)
  formData.append('artwork_type', type)
  formData.append('file', file)
  return API.post('/artwork/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(res => res.data)
}

export const getPublishRuns = () => API.get('/publish-runs').then(res => res.data as Array<{ id: number; user_id: string; run_time: string | null; status: string; item_count: number; error_message: string | null }>)
