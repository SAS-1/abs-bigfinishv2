import { BaseProvider } from '../BaseProvider'
import { BookMetadata, ParsedParameters, ProviderConfig } from '../../types'
import { normalizeBookMetadata } from '../../utils/helpers'
import { dbManager } from '../../database/manager'
import { httpClient } from '../../utils/httpClient'
import path from 'path'
import fs from 'fs'

const configPath = path.join(__dirname, 'config.json')
const config: ProviderConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'))

interface DeezerSearchAlbum {
  id: number
  title: string
  link: string
  cover: string
  cover_small: string
  cover_medium: string
  cover_big: string
  cover_xl: string
  record_type: string
  tracklist: string
  explicit_lyrics: boolean
  artist: {
    id: number
    name: string
    link: string
    picture: string
    picture_small: string
    picture_medium: string
    picture_big: string
    picture_xl: string
    tracklist: string
    type: string
  }
  type: string
}

interface DeezerAlbumDetails {
  id: number
  title: string
  upc: string
  link: string
  share: string
  cover: string
  cover_small: string
  cover_medium: string
  cover_big: string
  cover_xl: string
  genre_id: number
  genres?: {
    data?: Array<{
      id: number
      name: string
      picture: string
      type: string
    }>
  }
  label?: string
  nb_tracks: number
  duration: number
  fans: number
  release_date: string
  record_type: string
  available: boolean
  tracklist: string
  explicit_lyrics: boolean
  artist: {
    id: number
    name: string
    picture: string
    picture_small: string
    picture_medium: string
    picture_big: string
    picture_xl: string
    tracklist: string
    type: string
  }
  type: string
}

export default class DeezerProvider extends BaseProvider {
  constructor() {
    super(config)
  }

  async search(
    title: string,
    author: string | null,
    params: ParsedParameters,
    options?: { skipCache?: boolean }
  ): Promise<BookMetadata[]> {
    const accessToken = process.env.DEEZER_ACCESS_TOKEN
    const authParam = accessToken ? `&access_token=${encodeURIComponent(accessToken)}` : ''

    const limit = Math.min((params.limit as number) || 5, 10)
    const skipCache = options?.skipCache === true

    let query = author ? `artist:"${author}" album:"${title}"` : `album:"${title}"`
    let searchUrl = `https://api.deezer.com/search/album?q=${encodeURIComponent(query)}&limit=${limit}${authParam}`

    let searchRes = await httpClient.get(searchUrl)
    let albums: DeezerSearchAlbum[] = searchRes.status === 200 ? searchRes.data?.data || [] : []

    if (albums.length === 0) {
      const fallbackQuery = author ? `${title} ${author}` : title
      searchUrl = `https://api.deezer.com/search/album?q=${encodeURIComponent(fallbackQuery)}&limit=${limit}${authParam}`
      searchRes = await httpClient.get(searchUrl)
      albums = searchRes.status === 200 ? searchRes.data?.data || [] : []
    }

    const results: BookMetadata[] = []

    for (const album of albums.slice(0, limit)) {
      const albumUrl = `https://api.deezer.com/album/${album.id}${accessToken ? `?access_token=${encodeURIComponent(accessToken)}` : ''}`

      const albumCache = !skipCache ? dbManager.getBookCache(this.config.id, albumUrl) : null
      let albumData: DeezerAlbumDetails | undefined

      if (albumCache) {
        try {
          albumData = JSON.parse(albumCache)
        } catch {}
      }

      if (!albumData) {
        const detailRes = await httpClient.get(albumUrl)
        if (detailRes.status !== 200) continue
        albumData = detailRes.data
        if (albumData) {
          dbManager.setBookCache(this.config.id, albumUrl, JSON.stringify(albumData))
        }
      }

      if (albumData) {
        results.push(this.mapDeezerToMetadata(albumData))
      }
    }

    return results
  }

  private mapDeezerToMetadata(album: DeezerAlbumDetails): BookMetadata {
    const publishedYear = album.release_date ? album.release_date.slice(0, 4) : undefined
    const duration = album.duration ? Math.round(album.duration / 60) : undefined
    const coverUrl = album.cover_xl || album.cover_big || album.cover_medium || album.cover
    const genres = album.genres?.data?.map((g) => g.name?.trim()).filter(Boolean) as string[]

    return normalizeBookMetadata({
      title: album.title,
      author: album.artist?.name,
      publisher: album.label,
      publishedYear,
      cover: coverUrl,
      genres: genres && genres.length > 0 ? genres : undefined,
      duration,
      bookId: String(album.id),
      poweredBy: this.config.id
    })
  }
}
