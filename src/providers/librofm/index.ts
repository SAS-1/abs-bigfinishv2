import { BaseProvider } from '../BaseProvider'
import { SeriesMetadata, BookMetadata, ParsedParameters, ProviderConfig } from '../../types'
import { normalizeBookMetadata } from '../../utils/helpers'
import { httpClient } from '../../utils/httpClient'
import * as cheerio from 'cheerio'
import fs from 'fs'
import path from 'path'
import { JsonLdAudiobook, JsonLdImageObject } from './types'

const configPath = path.join(__dirname, 'config.json')
const config: ProviderConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'))

export default class LibroFMProvider extends BaseProvider {
  private readonly baseUrl: string = 'https://libro.fm'
  private readonly searchUrl: string = `${this.baseUrl}/search`
  private readonly bookUrl: string = `${this.baseUrl}/audiobooks`

  constructor() {
    super(config)
  }

  public async search(
    title: string,
    author: string | null,
    params: ParsedParameters,
    options?: { skipCache?: boolean }
  ): Promise<BookMetadata[]> {
    const results: BookMetadata[] = []

    const limit = (params['limit'] as number) || 10
    const searchby = (params['searchby'] as string) || 'all'
    const language = (params['lang'] as string) || 'all'

    const bookIds = await this.fetchBookIds(title, author, limit, searchby, language)
    console.log(`Fetched ${bookIds.length} book IDs from Libro.fm search results.`)

    for (const bookId of bookIds) {
      const bookMetadata = await this.getBookById(bookId)
      if (bookMetadata) {
        results.push(bookMetadata)
      }
    }

    return results
  }

  async getBookById(bookId: string): Promise<BookMetadata | null> {
    const bookUrl = `${this.bookUrl}/${bookId}`
    const bookRes = await httpClient.get(bookUrl, { headers: this.getHeaders() })
    if (bookRes.status === 404) return null
    if (bookRes.status !== 200) {
      throw new Error(`Error while fetching book from Libro.fm: ${bookRes.status}`)
    }

    const $ = cheerio.load(bookRes.data)

    const ldJsonRaw = $('script[type="application/ld+json"]').first().html() || ''
    let ld: Partial<JsonLdAudiobook> = {}
    let useJsonLd = true
    try {
      ld = JSON.parse(ldJsonRaw) as JsonLdAudiobook
    } catch {
      // JSON-LD malformed or missing — fallback to HTML parsing instead
      useJsonLd = false
    }

    const title = ld.name || $('h1.audiobook-title').text().trim()
    const subtitle = $('div.audiobook-title__subtitle').text().trim() || undefined
    const authors = this.extractAuthors($, ld, useJsonLd)
    const narrators = this.extractNarrators($, ld, useJsonLd)
    const publisher = ld.publisher || $('span[itemprop="publisher"]').text().trim() || undefined
    const publishedYear = this.extractPublishedYear($, ld, useJsonLd)
    const description = this.extractDescription($, ld, useJsonLd)
    const coverUrl = this.extractCoverUrl($, ld) || undefined
    const isbn = ld.isbn || $('span[itemprop="isbn"]').text().trim() || undefined
    const genres = $('div.audiobook-genres a')
      .toArray()
      .map((el) => $(el).text().trim())
      .filter((g) => g.length > 0)
    const seriesMetadata = this.extractSeriesMetadata($)
    const language = ld.inLanguage || $('span[itemprop="inLanguage"]').text().trim() || undefined
    const duration = this.extractDuration($, ld, useJsonLd)

    return normalizeBookMetadata({
      title,
      subtitle,
      author: authors.join(', ') || undefined,
      narrator: narrators.join(', ') || undefined,
      publisher,
      publishedYear,
      description,
      cover: coverUrl || undefined,
      isbn,
      bookId,
      genres: genres.length > 0 ? genres : undefined,
      series: seriesMetadata,
      language,
      duration,
      poweredBy: 'Libro.fm'
    })
  }

  private extractDescription(
    $: cheerio.CheerioAPI,
    ld: Partial<JsonLdAudiobook>,
    useJsonLd?: boolean
  ): string | undefined {
    let description: string | undefined
    if (useJsonLd && ld.description) {
      description = ld.description.trim()
    }
    if (!description) {
      // Fallback: clone the summary panel, remove genres, extract text
      description =
        $('div.tabs-panel#panel_summary')
          .clone()
          .find('div.audiobook-genres')
          .remove()
          .end()
          .children('p')
          .first()
          .html() || undefined
    }
    return description
  }

  private extractAuthors($: cheerio.CheerioAPI, ld: Partial<JsonLdAudiobook>, useJsonLd?: boolean): string[] {
    let authors: string[] = []
    if (useJsonLd && ld.author) {
      if (Array.isArray(ld.author)) {
        authors = ld.author
          .map((a) => (typeof a === 'string' ? a : a?.name))
          .filter((name): name is string => typeof name === 'string' && name.length > 0)
      } else if (typeof ld.author === 'string') {
        authors = [ld.author]
      } else if (ld.author?.name) {
        authors = [ld.author.name]
      }
    }
    if (authors.length === 0) {
      authors = $('span[itemprop="author"] a')
        .toArray()
        .map((el) => $(el).text().trim())
        .filter(Boolean)
    }
    return authors
  }

  private extractNarrators($: cheerio.CheerioAPI, ld: Partial<JsonLdAudiobook>, useJsonLd?: boolean): string[] {
    let narrators: string[] = []
    if (useJsonLd && ld.readBy) {
      if (Array.isArray(ld.readBy)) {
        narrators = ld.readBy
          .map((n) => (typeof n === 'string' ? n : n?.name))
          .filter((name): name is string => typeof name === 'string' && name.length > 0)
      } else if (typeof ld.readBy === 'string') {
        narrators = [ld.readBy]
      } else if (ld.readBy?.name) {
        narrators = [ld.readBy.name]
      }
    }
    if (narrators.length === 0) {
      narrators = $('p:contains("Narrators") span a')
        .toArray()
        .map((el) => $(el).text().trim())
        .filter(Boolean)
      if (narrators.length === 0) {
        // Broader fallback: links after the "Narrators" strong tag
        narrators = $('div.audiobook-information__additional a[href*="searchby=narrators"]')
          .toArray()
          .map((el) => $(el).text().trim())
          .filter(Boolean)
      }
    }
    return narrators
  }

  private extractDuration(
    $: cheerio.CheerioAPI,
    ld: Partial<JsonLdAudiobook>,
    useJsonLd?: boolean
  ): number | undefined {
    let duration: number | undefined
    if (useJsonLd && ld.duration) {
      // Parse "PT12H27M40S" format
      const isoMatch = ld.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
      if (isoMatch) {
        const h = parseInt(isoMatch[1] || '0', 10)
        const m = parseInt(isoMatch[2] || '0', 10)
        duration = h * 60 + m
      }
    }
    if (duration === undefined) {
      // Fallback: parse text like "12 hours 27 minutes"
      const lengthText = $('strong:contains("Length")').parent().text()
      const lengthMatch = lengthText.match(/(\d+)\s*hours?\s*(\d+)?\s*minutes?/)
      if (lengthMatch) {
        duration = parseInt(lengthMatch[1], 10) * 60 + parseInt(lengthMatch[2] || '0', 10)
      }
    }
    return duration
  }

  private extractPublishedYear(
    $: cheerio.CheerioAPI,
    ld: Partial<JsonLdAudiobook>,
    useJsonLd?: boolean
  ): string | undefined {
    let publishedYear: string | undefined
    if (useJsonLd && ld.datePublished) {
      publishedYear = ld.datePublished.match(/\d{4}/)?.[0] || ld.datePublished
    }
    if (!publishedYear) {
      const dateRaw = $('span[itemprop="datePublished"]').text().trim()
      publishedYear = dateRaw.match(/\d{4}/)?.[0] || dateRaw || undefined
    }
    return publishedYear
  }

  private extractCoverUrl($: cheerio.CheerioAPI, ld: Partial<JsonLdAudiobook>, useJsonLd?: boolean): string | null {
    let coverUrl: string | undefined

    if (useJsonLd && ld.image) {
      if (typeof ld.image === 'string') {
        coverUrl = ld.image
      } else if ('contentUrl' in ld.image) {
        coverUrl = (ld.image as JsonLdImageObject).contentUrl
      }
    }

    if (!coverUrl) {
      coverUrl = $('img.book-cover').attr('src') || ''
    }

    if (coverUrl.startsWith('//')) {
      coverUrl = `https:${coverUrl}`
    } else if (coverUrl && !coverUrl.startsWith('http')) {
      coverUrl = `https://libro.fm${coverUrl}`
    }

    return coverUrl || null
  }

  private extractSeriesMetadata($: cheerio.CheerioAPI): SeriesMetadata[] | null {
    const seriesMetadata: SeriesMetadata[] = []
    const seriesText = $('div.audiobook-title__series').text().trim()

    // Example: "S.F. MASTERWORKS: Book #248", "Series Name #5", "Series: Book 3"
    const seriesMatch = seriesText.match(/^(.+?)(?::\s*)?(?:Book\s*)?#?\s*(\d+)/i)

    if (seriesMatch) {
      seriesMetadata.push({
        series: seriesMatch[1].trim(),
        sequence: seriesMatch[2]?.toString() || undefined
      })
    }

    return seriesMetadata.length > 0 ? seriesMetadata : null
  }

  private async fetchBookIds(
    title: string,
    author: string | null,
    limit: number,
    searchby: string,
    language: string
  ): Promise<string[]> {
    /*
    fetch first `limit` book ids from the public search page. 
    the links look like this: https://libro.fm/audiobooks/<book-id>-<book-title>
    search page: https://libro.fm/search?q=<search-query>&searchby=<searchby>&language_<language>=true
    (language should only be included if it's not 'all')
    */
    this.validateParameters(title, author, limit, searchby, language)
    const searchUrl = this.getSearchURL(title, author, searchby, language)
    const searchRes = await httpClient.get(searchUrl, { headers: this.getHeaders() })
    if (searchRes.status === 404) {
      return []
    }

    if (searchRes.status !== 200) {
      throw new Error(`Error while searching Libro.fm: ${searchRes.status}`)
    }

    const $ = cheerio.load(searchRes.data)
    const bookIds: string[] = []

    for (const gridItem of $('.book-grid-item:not(.book-grid-item__promo)').toArray()) {
      // FIXME: should books not yet released be disregarded?
      const bookLink = $(gridItem).find('.book[href*="/audiobooks/"]').first()

      if (bookLink.length > 0) {
        const href = bookLink.attr('href') || ''
        // audiobook URL scheme: /audiobooks/<book-id>-<title>
        const match = href.match(/\/audiobooks\/([^-]+)/)

        if (match?.[1]) {
          bookIds.push(match[1])

          if (bookIds.length >= limit) {
            break
          }
        }
      }
    }
    return bookIds
  }

  private getSearchURL(title: string, author: string | null, searchby: string, language: string): string {
    const searchParams = new URLSearchParams({
      q: `${title}${author ? `+${author}` : ''}`
    })
    if (searchby !== 'all') {
      searchParams.append('searchby', searchby)
    }
    if (language !== 'all') {
      searchParams.append(`language_${language}`, 'true')
    }
    const searchUrl = `${this.searchUrl}?${searchParams.toString()}`
    console.log(`Constructed search URL: ${searchUrl}`)
    return searchUrl
  }

  private validateParameters(
    title: string,
    author: string | null,
    limit: number,
    searchby: string,
    language: string
  ): void {
    if (title.trim() === '') {
      throw new Error('Title is required')
    }

    const limitDef = this.getConfigParam('limit')
    if (limitDef?.validation && limit < (limitDef.validation.min ?? 1)) {
      throw new Error(`Limit must be >= ${limitDef.validation.min}`)
    }
    if (limitDef?.validation && limit > (limitDef.validation.max ?? 20)) {
      throw new Error(`Limit must be <= ${limitDef.validation.max}`)
    }

    const langDef = this.getConfigParam('lang')
    if (language !== 'all' && langDef?.validation.values && !langDef.validation.values.includes(language)) {
      throw new Error(`Invalid language value: ${language}`)
    }

    const searchbyDef = this.getConfigParam('searchby')
    if (searchbyDef?.validation.values && !searchbyDef.validation.values.includes(searchby)) {
      throw new Error(`Invalid searchby value: ${searchby}. Valid options: ${searchbyDef.validation.values.join(', ')}`)
    }

    if (searchby === 'author' && (!author || author.trim() === '')) {
      throw new Error('Author is required when searchby is "author"')
    }
  }

  private getConfigParam(paramName: string) {
    const configParam = this.config.parameters.find((param) => param.name === paramName)
    return configParam
  }

  private getHeaders(): Record<string, string> {
    return {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  }
}
