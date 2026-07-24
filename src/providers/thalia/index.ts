import { BaseProvider } from '../BaseProvider'
import { BookMetadata, ParsedParameters, ProviderConfig } from '../../types'
import path from 'path'
import fs from 'fs'
import { ThaliaResponse, ThaliaSearchResult } from './types'
import { httpClient } from '../../utils/httpClient'

const configPath = path.join(__dirname, 'config.json')
const config: ProviderConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'))

export default class ThaliaProvider extends BaseProvider {
  constructor() {
    super(config)
  }

  async search(
    title: string,
    _author: string | null,
    params: ParsedParameters,
    _options?: { skipCache?: boolean }
  ): Promise<BookMetadata[]> {
    const limit = Math.min((params.limit as number) || 5, 30)

    const searchUrl = `https://app.thalia.de/api/rest/suche/v5/?suchbegriff=${encodeURIComponent(title.replace(/\s+/g, '+'))}&gewuenschteSeite=1&artikelServiceAufrufen=true&anzahlArtikelProSeite=${limit}`

    console.log(searchUrl)
    const searchRes = await httpClient.get(searchUrl)
    console.log(searchRes.status, searchRes.data)
    if (searchRes.status !== 200) throw new Error('Thalia search API error')
    const searchJson = searchRes.data as ThaliaResponse
    const searchResults = searchJson.artikelliste || []

    const audiobookFilter: string[] = ['Hörbuch', 'Hörspiel', 'Audiobook']
    const bookFilter: string[] = ['Buch', 'eBook', 'E-Book', 'Taschenbuch', 'Hardcover']

    const books: BookMetadata[] = []
    for (const result of searchResults
      .filter((f) =>
        params.type
          ? (audiobookFilter.some((format) => f.formatbezeichnung.includes(format)) && params.type === 'audiobook') ||
            (bookFilter.some((format) => f.formatbezeichnung.includes(format)) && params.type === 'ebook') ||
            (bookFilter.concat(audiobookFilter).some((format) => f.formatbezeichnung.includes(format)) &&
              params.type === 'all')
          : true
      )
      .slice(0, limit)) {
      console.log(result)

      const metadata = this.mapThaliaToMetadata(result, params)
      if (metadata.title) {
        books.push(metadata)
      }
    }

    return books
  }

  // @ts-ignore
  private mapThaliaToMetadata(result: ThaliaSearchResult, params: ParsedParameters): BookMetadata {
    return undefined as any
  }
}
