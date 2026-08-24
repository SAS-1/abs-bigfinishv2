export interface CacheMeta {
  etag?: string
  lastChecked: number
}

export interface DreifragChapter {
  titel: string
  start: number
  end: number
}

export interface DreifragRole {
  rolle: string
  sprecher: string
  pseudonym?: string
}

export interface DreifragLinks {
  json?: string
  cover?: string
  cover_itunes?: string
  cover_kosmos?: string
  dreifragezeichen?: string
  spotify?: string
  appleMusic?: string
  bookbeat?: string
  amazonMusic?: string
  amazon?: string
  youTubeMusic?: string
  deezer?: string
}

export interface DreifragEpisode {
  nummer: number
  titel: string
  autor?: string
  hörspielskriptautor?: string
  gesamtbeschreibung?: string
  beschreibung?: string
  veröffentlichungsdatum?: string
  gesamtdauer?: number
  kapitel?: DreifragChapter[]
  sprechrollen?: DreifragRole[]
  links?: DreifragLinks
}

export interface DreifragData {
  serie: DreifragEpisode[]
}

export interface DreifragSpezialEpisode {
  titel: string
  autor?: string
  hörspielskriptautor?: string
  gesamtbeschreibung?: string
  beschreibung?: string
  metabeschreibung?: string
  veröffentlichungsdatum?: string
  gesamtdauer?: number
  kapitel?: DreifragChapter[]
  sprechrollen?: DreifragRole[]
  links?: DreifragLinks
}

export interface DreifragSpezialData {
  spezial: DreifragSpezialEpisode[]
}

export interface DreifragKidsData {
  kids: DreifragEpisode[]
}

export type DreifragSource = 'serie' | 'spezial' | 'kids'

export interface DreifragScoredItem {
  source: DreifragSource
  score: number
  ep: DreifragEpisode | DreifragSpezialEpisode
}
