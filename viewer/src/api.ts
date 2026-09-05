import axios from 'axios'
import type { CatalogData, SearchData } from './types'

const API_URL = import.meta.env.VITE_API_URL ?? `${window.location.protocol}//${window.location.hostname}:8000`

const API = axios.create({ baseURL: API_URL })

// Add a base URL helper for images since we store relative paths
export const getImageUrl = (path: string | null) => {
  if (!path) return 'https://via.placeholder.com/600x900?text=No+Image'
  return `${API_URL}/${path}`
}

export const getCatalog = () => API.get<CatalogData>('/catalog').then(res => res.data)

export const searchCatalog = (params: { q?: string; category?: string; language?: string; section?: string }) =>
  API.get<SearchData>('/catalog/search', { params }).then(res => res.data)
