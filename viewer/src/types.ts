export interface CatalogArtwork {
  poster: string | null
  banner: string | null
  thumbnail: string | null
}

export interface CatalogEpisode {
  id: string
  title: string
  content_group: string
  languages: string[]
  duration: number | null
  artwork: CatalogArtwork
}

export interface CatalogSeason {
  id: string
  season_number: number
  episodes: CatalogEpisode[]
}

export interface CatalogShow {
  id: string
  title: string
  category: string
  seasons: CatalogSeason[]
}

export interface CatalogData {
  sections: {
    [sectionName: string]: CatalogShow[]
  }
  published_at: string
}

export interface SearchResultShow extends Omit<CatalogShow, 'seasons'> {
  matching_episodes: CatalogEpisode[]
}

export interface SearchData {
  results: SearchResultShow[]
}
