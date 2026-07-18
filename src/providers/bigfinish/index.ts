import { BaseProvider } from '../BaseProvider'
import { BookMetadata, ParsedParameters, ProviderConfig } from '../../types'
import { normalizeBookMetadata } from '../../utils/helpers'
import { dbManager } from '../../database/manager'
import { httpClient } from '../../utils/httpClient'
import path from 'path'
import fs from 'fs'
import * as cheerio from 'cheerio'
import type { Element } from 'domhandler'

const configPath = path.join(__dirname, 'config.json')
const config: ProviderConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'))

const BASE_URL = 'https://www.bigfinish.com'
const SEARCH_URL = `${BASE_URL}/api/search`

const SEARCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Content-Type': 'application/json',
  Origin: BASE_URL,
  Connection: 'keep-alive'
}

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  Connection: 'keep-alive'
}

interface BigFinishSearchHit {
  id: number
  release_slug: string
  name: string
  range_id: number | null
  description: string | null
  duration: string | null
  image: string | null
  contributors: { name: string }[]
}

interface BigFinishSearchResponse {
  hits: BigFinishSearchHit[]
  estimatedTotalHits: number
  limit: number
  offset: number
  query: string
}

interface ParsedBookData {
  url: string
  title: string | null
  series: string | null
  seriesTag: string | null
  releaseDate: string | null
  about: string | null
  duration: string | null
  writtenBy: string | null
  narratedBy: string | null
  coverUrl: string | null
}

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12
}

export default class BigFinishProvider extends BaseProvider {
  constructor() {
    super(config)
  }

  async search(
    title: string,
    _author: string | null,
    params: ParsedParameters,
    options?: { skipCache?: boolean }
  ): Promise<BookMetadata[]> {
    const limit = Math.min((params.limit as number) || 5, 10)
    const skipCache = options?.skipCache === true

    // Colons in titles confuse the search engine — replace with spaces
    const query = title.replace(/:/g, ' ')

    const searchRes = await httpClient.post(
      SEARCH_URL,
      { q: query, limit: limit * 2, offset: 0 },
      { headers: SEARCH_HEADERS }
    )

    if (searchRes.status !== 200) {
      throw new Error(`Big Finish search API error: ${searchRes.status}`)
    }

    const searchData = searchRes.data as BigFinishSearchResponse
    const hits = (searchData.hits ?? []).slice(0, limit)

    const books: BookMetadata[] = []

    for (const hit of hits) {
      if (!hit.release_slug) continue

      const productUrl = `${BASE_URL}/releases/v/${hit.release_slug}`

      let bookData: ParsedBookData | null = null

      if (!skipCache) {
        const bookCache = dbManager.getBookCache(this.config.id, productUrl)
        if (bookCache) {
          try {
            bookData = JSON.parse(bookCache)
          } catch {}
        }
      }

      if (!bookData) {
        const pageRes = await httpClient.get(productUrl, {
          headers: BROWSER_HEADERS,
          responseType: 'text'
        })

        if (pageRes.status === 200) {
          const html = typeof pageRes.data === 'string' ? pageRes.data : String(pageRes.data)
          bookData = this.parseProductPage(productUrl, html, hit)

          if (bookData && !skipCache) {
            dbManager.setBookCache(this.config.id, productUrl, JSON.stringify(bookData))
          }
        }
      }

      if (bookData) {
        const metadata = this.mapToMetadata(bookData)
        if (metadata.title) {
          books.push(metadata)
        }
      }
    }

    return books
  }

  /**
   * Parse a product page HTML and return a ParsedBookData.
   * The search hit is passed so that fields present in the search result
   * (description, duration, cover, contributors) can be used as fallbacks
   * when not found in the page HTML.
   */
  private parseProductPage(url: string, html: string, hit: BigFinishSearchHit): ParsedBookData {
    const $ = cheerio.load(html)

    const data: ParsedBookData = {
      url,
      title: null,
      series: null,
      seriesTag: null,
      releaseDate: null,
      about: null,
      duration: null,
      writtenBy: null,
      narratedBy: null,
      coverUrl: null
    }

    // TITLE + SERIES TAG
    // h1 contains the full product name, e.g.:
    //   "Doctor Who: The Fourth Doctor Adventures Series 15: Lethal Progress (15B)"
    //   "Doctor Who: Precious Annihilation"
    const h1Text = $('h1').first().text().trim()
    if (h1Text) {
      const extracted = this.extractTitleParts(h1Text)
      data.title = extracted.title
      data.series = extracted.series
      data.seriesTag = extracted.seriesTag
    }

    // SERIES (range name) — the range link is more canonical than the series prefix in the h1
    const rangeLink = $('a[href*="/ranges/v/"]').first()
    if (rangeLink.length) {
      data.series = rangeLink.text().trim() || data.series
    }

    // COVER — og:image is the most reliable source
    const ogImage = $('meta[property="og:image"]').attr('content')
    if (ogImage) {
      data.coverUrl = ogImage
    } else if (hit.image) {
      data.coverUrl = hit.image
    }

    // RELEASE DATE — "Released Month YYYY" pattern in body text
    const bodyText = $('body').text()
    const releasedMatch = bodyText.match(/Released\s+([A-Za-z]+\s+\d{4})/i)
    if (releasedMatch) {
      data.releaseDate = this.parseReleaseDate(releasedMatch[1])
    }

    // DURATION — "Duration: NNN minutes" pattern in body text
    const durationMatch = bodyText.match(/Duration:\s*(\d+)\s*minutes?/i)
    if (durationMatch) {
      data.duration = durationMatch[1]
    } else if (hit.duration) {
      data.duration = hit.duration
    }

    // DESCRIPTION — longer prose paragraphs from the product page are preferred over
    // the short promotional blurb in the search result
    const mainParas: string[] = []
    $('main p, article p').each((_: number, el: Element) => {
      const text = $(el).text().trim()
      if (text.length > 80) mainParas.push(text)
    })
    if (mainParas.length > 0) {
      data.about = mainParas.join('\n\n')
    } else if (hit.description) {
      data.about = hit.description
    }

    // CONTRIBUTORS — match "Written By:" and "Starring:" labels within the
    // main content, then take only the text on that same line.
    // Using line-bounded matching avoids greedy overruns into the description
    // and prevents the "You might also be interested" block from polluting narrator.
    const scopeText = ($('main').text() || $('body').text()).replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n')

    const splitNames = (s: string): string[] =>
      s
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean)

    const writtenMatch = scopeText.match(/Written By:\s*([^\n]+)/i)
    if (writtenMatch) {
      const names = splitNames(writtenMatch[1])
      if (names.length) data.writtenBy = names.join(', ')
    }

    const starringMatch = scopeText.match(/Starring:\s*([^\n]+)/i)
    if (starringMatch) {
      const names = splitNames(starringMatch[1])
      if (names.length) data.narratedBy = names.join(', ')
    }

    if (!data.narratedBy && hit.contributors?.length > 0) {
      data.narratedBy = hit.contributors.map((c) => c.name).join(', ')
    }

    return data
  }

  /**
   * Extract the series name, series tag, and short title from a full product name.
   *
   * The new site uses the pattern: "{Series}: {Title} ({Tag})"
   * where Tag is optional (e.g. "15B", "4").
   *
   * Examples:
   *   "Doctor Who: The Fourth Doctor Adventures Series 15: Lethal Progress (15B)"
   *     -> series:    "Doctor Who: The Fourth Doctor Adventures Series 15"
   *        seriesTag: "15B"
   *        title:     "Lethal Progress"
   *
   *   "Doctor Who: Precious Annihilation"
   *     -> series:    "Doctor Who"
   *        seriesTag: null
   *        title:     "Precious Annihilation"
   *
   *   "Torchwood: Miracle Day"
   *     -> series:    "Torchwood"
   *        seriesTag: null
   *        title:     "Miracle Day"
   */
  private extractTitleParts(fullName: string): {
    series: string | null
    seriesTag: string | null
    title: string
  } {
    // Strip trailing "(Tag)" e.g. "(15B)" or "(4)"
    const tagMatch = fullName.match(/\((\d+[A-Z]?)\)\s*$/)
    const seriesTag = tagMatch ? tagMatch[1] : null
    const withoutTag = tagMatch ? fullName.slice(0, tagMatch.index).trim() : fullName

    // Split on the LAST colon to separate series from episode title
    const lastColon = withoutTag.lastIndexOf(':')
    if (lastColon === -1) {
      return { series: null, seriesTag, title: withoutTag }
    }

    const series = withoutTag.slice(0, lastColon).trim()
    const title = withoutTag.slice(lastColon + 1).trim()

    return {
      series: series || null,
      seriesTag,
      title: title || withoutTag
    }
  }

  private parseReleaseDate(dateText: string): string | null {
    if (!dateText) return null

    let text = dateText.toLowerCase().trim()
    if (text.startsWith('released ')) {
      text = text.substring(9).trim()
    }

    const match = text.match(/([a-zA-Z]+)\s+(\d{4})/)
    if (!match) return null

    const monthNum = MONTHS[match[1].toLowerCase()]
    if (!monthNum) return null

    const month = monthNum.toString().padStart(2, '0')
    return `${match[2]}-${month}-01`
  }

  private mapToMetadata(data: ParsedBookData): BookMetadata {
    const publishedYear = data.releaseDate ? data.releaseDate.split('-')[0] : undefined

    const series = data.series ? [{ series: data.series, sequence: data.seriesTag || undefined }] : undefined

    const duration = data.duration ? parseInt(data.duration, 10) : undefined

    return normalizeBookMetadata({
      title: data.title,
      author: data.writtenBy,
      narrator: data.narratedBy,
      description: data.about,
      cover: data.coverUrl,
      series,
      language: 'en',
      publishedYear,
      publisher: 'Big Finish',
      duration
    })
  }
}
