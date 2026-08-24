export interface AudiobookSearchItem {
  title: string
  isbn: number
  authors: string[]
  cover_url: string
  catalog_info: {
    bookseller_pick: boolean
    new_release: boolean
    coming_soon: boolean
  }
  audiobook_info: {
    narrators: string[]
  }
}

export interface SearchApiResponse {
  user_info: {
    signed_in: boolean
  }
  audiobook_collection: {
    audiobooks: AudiobookSearchItem[]
  }
}

export interface Genre {
  id: number
  name: string
  html_name: string
}

export interface AudiobookDetailsInfo {
  narrators: string[]
  version_num: number
  tracks_updated_at: string
  duration: number
  size_bytes: number
  track_count: number
  parts_count: number
  pdf_extras: any[]
  audio_language: string
  audio_language_display: string
  ai_narrated: boolean
}

export interface AudiobookDetails {
  id: number
  title: string
  isbn: number
  updated_at: string
  description: string
  abridged: boolean
  series: string | null
  series_num: string | number | null
  lead: string | null
  genres: Genre[]
  recommendations: any[]
  audiobook_info: AudiobookDetailsInfo
  authors: string[]
  cover_url: string
  catalog_info: {
    bookseller_pick: boolean
    new_release: boolean
    coming_soon: boolean
  }
  subtitle: string | null
  publisher: string
  publication_date: string
  created_at: string
}

export interface DetailsApiResponse {
  user_info: {
    signed_in: boolean
  }
  data: {
    audiobook: AudiobookDetails
    sample_url: string
    playlists: any[]
    related_audiobooks: any[]
  }
}
