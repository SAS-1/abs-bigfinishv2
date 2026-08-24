import { BaseProvider } from '../BaseProvider'
import { BookMetadata, ParsedParameters, ProviderConfig } from '../../types'
import { normalizeBookMetadata } from '../../utils/helpers'
import { httpClient } from '../../utils/httpClient'
import * as cheerio from 'cheerio'
import path from 'path'
import fs from 'fs'

import { AUDIOTEKA_LANGUAGES, AudiotekaSearchMatch, AudiotekaFullMetadata } from './types'
import { parseSearchResults, parseBookDetails } from './utils'

const configPath = path.join(__dirname, 'config.json')
const config: ProviderConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'))

export default class AudiotekaProvider extends BaseProvider {
  constructor() {
    super(config)
  }

  async search(
    title: string,
    _author: string | null,
    params: ParsedParameters,
    _options?: { skipCache?: boolean }
  ): Promise<BookMetadata[]> {
    const lang = params.lang as string
    const limit = Math.min((params.limit as number) || 5, 20)

    const langConfig = AUDIOTEKA_LANGUAGES[lang]
    if (!langConfig) {
      throw new Error(`Unsupported language: ${lang}`)
    }

    const searchUrl = `${langConfig.searchUrl}?phrase=${encodeURIComponent(title)}`

    const searchRes = await httpClient.get(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': langConfig.acceptLanguage
      }
    })

    if (searchRes.status !== 200) {
      console.warn(`Audioteka search returned status ${searchRes.status} for query: ${title}`)
      return []
    }

    const $ = cheerio.load(searchRes.data as string)
    const searchMatches = parseSearchResults($)

    const books: BookMetadata[] = []
    const limitedMatches = searchMatches.slice(0, limit)

    for (const match of limitedMatches) {
      try {
        const fullMetadata = await this.fetchBookDetails(match, lang)
        const metadata = this.mapToBookMetadata(fullMetadata)
        if (metadata.title) {
          books.push(metadata)
        }
      } catch (error) {
        console.error(`Error fetching details for ${match.title}:`, error)
        const basicMetadata = this.mapToBookMetadata({
          ...match,
          language: langConfig.languageName
        })
        if (basicMetadata.title) {
          books.push(basicMetadata)
        }
      }
    }

    return books
  }

  private async fetchBookDetails(match: AudiotekaSearchMatch, lang: string): Promise<AudiotekaFullMetadata> {
    const langConfig = AUDIOTEKA_LANGUAGES[lang]

    const response = await httpClient.get(match.url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': langConfig.acceptLanguage
      }
    })

    if (response.status !== 200) {
      throw new Error(`Failed to fetch book details: ${response.status}`)
    }

    const $ = cheerio.load(response.data as string)
    return parseBookDetails($, match, langConfig)
  }

  private mapToBookMetadata(data: AudiotekaFullMetadata): BookMetadata {
    return normalizeBookMetadata({
      title: data.title,
      author: data.authors.join(', '),
      narrator: data.narrator,
      publisher: data.publisher,
      description: data.description,
      cover: data.cover,
      genres: data.genres,
      tags: data.series,
      language: data.language,
      duration: data.duration
    })
  }
}
