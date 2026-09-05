export interface Show {
  id: string
  title: string
  section: string | null
  category: string
  status: 'draft' | 'published'
  seasons?: Season[]
}

export interface Season {
  id: string
  show_id: string
  season_number: number
  episodes?: Episode[]
}

export interface Episode {
  id: string
  season_id: string
  title: string
  content_group: string
  language: string
  duration: number | null
}

export interface Artwork {
  id: number
  episode_id: string
  poster_path: string | null
  banner_path: string | null
  thumbnail_path: string | null
}

export interface ValidationIssue {
  title: string
  type: 'show' | 'episode'
  issue?: string
  issues?: string[]
  show_title?: string
}

export interface ValidationReport {
  blocking_issues: ValidationIssue[]
}
