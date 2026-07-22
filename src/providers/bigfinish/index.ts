import { BaseProvider } from '../BaseProvider'
import { BookMetadata, ParsedParameters, ProviderConfig } from '../../types'
import { normalizeBookMetadata } from '../../utils/helpers'
import { dbManager } from '../../database/manager'
import { httpClient } from '../../utils/httpClient'
import path from 'path'
import fs from 'fs'

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

const RSC_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  rsc: '1'
}

const SERIES_MAPPING: Record<string, string> = {
    "Class": "Class (CL)",
    "Counter-Measures": "Counter Measures (CM)",
    "Cyberman": "Cyberman (CY)",
    "Doctor Who - The Monthly Adventures": "D0. Dr Who - Main Range (MR)",
    "Doctor Who - The First Doctor Adventures": "D1. The First Doctor Adventures (1DA)",
    "Doctor Who - The Tenth Doctor Adventures": "D10. The Tenth Doctor Adventures (10DA)",
    "Doctor Who - The Second Doctor Adventures": "D2. The Second Doctor Adventures (2DA)",
    "Doctor Who - The Third Doctor Adventures": "D3. The Third Doctor Adventures (3DA)",
    "Doctor Who - The Fourth Doctor Adventures": "D4. The Fourth Doctor Adventures (4DA)",
    "Doctor Who - The Fifth Doctor Adventures": "D5. The Fifth Doctor Adventures (5DA)",
    "Doctor Who - The Sixth Doctor Adventures": "D6. The Sixth Doctor Adventures (6DA)",
    "Doctor Who - The Seventh Doctor Adventures": "D7. The Seventh Doctor Adventures (7DA)",
    "Doctor Who - The Eighth Doctor Adventures": "D8. The Eighth Doctor Adventures (8DA)",
    "Doctor Who - The Ninth Doctor Adventures": "D9. The Ninth Doctor Adventures (9DA)",
    "Doctor Who: The First Doctor Adventures": "D1. The First Doctor Adventures (1DA)",
    "Doctor Who: The Tenth Doctor Adventures": "D10. The Tenth Doctor Adventures (10DA)",
    "Doctor Who: The Second Doctor Adventures": "D2. The Second Doctor Adventures (2DA)",
    "Doctor Who: The Third Doctor Adventures": "D3. The Third Doctor Adventures (3DA)",
    "Doctor Who: The Fourth Doctor Adventures": "D4. The Fourth Doctor Adventures (4DA)",
    "Doctor Who: The Fifth Doctor Adventures": "D5. The Fifth Doctor Adventures (5DA)",
    "Doctor Who: The Sixth Doctor Adventures": "D6. The Sixth Doctor Adventures (6DA)",
    "Doctor Who: The Seventh Doctor Adventures": "D7. The Seventh Doctor Adventures (7DA)",
    "Doctor Who: The Eighth Doctor Adventures": "D8. The Eighth Doctor Adventures (8DA)",
    "Doctor Who: The Ninth Doctor Adventures": "D9. The Ninth Doctor Adventures (9DA)",
    "Dalek Empire": "Dalek Empire (DE)",
    "Dark Gallifrey": "Dark Gallifrey (DG)",
    "Doctor Who - Destiny of the Doctor": "Destiny of the Doctor",
    "Doom's Day": "Doom's Day (DD)",
    "Bernice Summerfield": "F1. Bernice Summerfield (BS)",
    "Bernice Summerfield - Books & Audiobooks": "F2. Bernice Summerfield Audiobooks (BSAB)",
    "Bernice Summerfield: Books & Audiobooks": "F2. Bernice Summerfield Audiobooks (BSAB)",    
    "Doctor Who - The New Adventures of Bernice Summerfield": "F3. The New Adventures of Bernice Summerfield (NABS)",
    "Doctor Who: The New Adventures of Bernice Summerfield": "F3. The New Adventures of Bernice Summerfield (NABS)",    
    "Gallifrey": "Gallifrey (GAL)",
    "I, Davros": "I, DAVROS",
    "Jago & Litefoot": "Jago & Litefoot (J&L)",
    "Missy": "Missy (MIS)",
    "Doctor Who - Once and Future": "Once and Future (O&F)",
    "Doctor Who - Philip Hinchcliffe Presents": "Philip Hincliffe Presents (PHP)",
    "Doctor Who - Short Trips Rarities": "Rarities & Subcriber Short Trips (SST)",
    "Doctor Who: Once and Future": "Once and Future (O&F)",
    "Doctor Who: Philip Hinchcliffe Presents": "Philip Hincliffe Presents (PHP)",
    "Doctor Who: Short Trips Rarities": "Rarities & Subcriber Short Trips (SST)",    
    "Rose Tyler": "Rose Tyler The Dimension Cannon (RT)",
    "Sarah Jane Smith": "Sarah Jane Smith (SJS)",
    "Doctor Who - Short Trips": "Short Trips (ST)",
    "The Worlds of Doctor Who - Special Releases": "Special Releases (SP)",
    "Doctor Who: Short Trips": "Short Trips (ST)",
    "The Worlds of Doctor Who: Special Releases": "Special Releases (SP)",    
    "Doctor Who: The Classic Series: Special Releases": "Special Releases (SP)",
    "Torchwood - Monthly Range": "T0. Torchwood Main Range (TMR)",
    "Torchwood - Special Releases": "T1. Torchwood - Specials (TWsp)",
    "Torchwood: Monthly Range": "T0. Torchwood Main Range (TMR)",
    "Torchwood: Special Releases": "T1. Torchwood - Specials (TWsp)",    
    "Torchwood One": "T2. Torchwood One (TW1)",
    "Torchwood - The Story Continues": "T3. Torchwood - The Story Continues",
    "Torchwood: The Story Continues": "T3. Torchwood - The Story Continues",    
    "Torchwood Soho": "T4. Torchwood Soho (TWS)",
    "Doctor Who - The Audio Novels": "The Audio Novels",
    "Doctor Who - The Companion Chronicles": "The Companion Chronicles (CC)",
    "Doctor Who: The Audio Novels": "The Audio Novels",
    "Doctor Who: The Companion Chronicles": "The Companion Chronicles (CC)",    
    "River Song": "The Diary of River Song (RS)",
    "Doctor Who - The Doctor Chronicles": "The Doctor Chronicles (TDC)",
    "Doctor Who - The Early Adventures": "The Early Adventures (EA)",
    "Doctor Who: The Doctor Chronicles": "The Doctor Chronicles (TDC)",
    "Doctor Who: The Early Adventures": "The Early Adventures (EA)",
    "The Lives of Captain Jack": "The Lives of Captain Jack (LCJ)",
    "Doctor Who - The Lost Stories": "The Lost Stories (LS)",
    "Doctor Who: The Lost Stories": "The Lost Stories (LS)",
    "The Paternoster Gang": "The Paternoster Gang (PAT)",
    "The Robots": "The Robots (ROB)",
    "Doctor Who - The Stageplays": "The Stageplays (STG)",
    "Doctor Who - The War Doctor": "The War Doctor (WD)",
    "Doctor Who: The Stageplays": "The Stageplays (STG)",
    "Doctor Who: The War Doctor": "The War Doctor (WD)",    
    "The War Master": "The War Master (WM)",
    "Doctor Who - Time Lord Victorious": "Time Lord Victorious (TLV)",
    "Doctor Who: Time Lord Victorious": "Time Lord Victorious (TLV)",    
    "UNIT": "UNIT (UNIT)",
    "UNIT - The New Series": "UNIT - The New Series (UNITNS)",
    "UNIT: The New Series": "UNIT - The New Series (UNITNS)",    
    "Iris Wildthyme": "F4. Iris Wildthyme (IW)",
    "Iris Wildthyme and Friends":"F5. Iris Wildthyme & Friends (IWF)",
    "Graceless": "F6. Graceless",
    "Doctor Who - Unbound": "Unbound (UN)",
    "Vienna": "F7. Vienna",
    "Charlotte Pollard": "F8. Charlotte Pollard",
    "Doctor Who - The Fugitive Doctor": "The Fugitive Doctor Adventures (FDA)",
    "Doctor Who: The Fugitive Doctor": "The Fugitive Doctor Adventures (FDA)",    
    "Call Me Master": "Call Me Master (CMM)",
    "Susan's War": "Susan's War (SW)",
    "V UK": "V - UK",
    "Planet Krynoid": "Planet Krynoid (PG)"
    }

interface BigFinishSearchResult {
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
  hits: BigFinishSearchResult[]
  estimatedTotalHits: number
  limit: number
  offset: number
  query: string
}

interface ParsedBookData {
  schemaVersion: 3
  url: string
  title: string | null
  series: string | null
  seriesTag: string | null
  releaseDate: string | null
  about: string | null
  duration: string | null
  writtenBy: string | null
  narratedBy: string | null
  tags?: string[]
  coverUrl: string | null
  isbn: string | null
}

interface NamedContributor {
  name?: string
  label?: string
}

interface BigFinishReleaseData {
  title?: string
  range?: string
  release_number?: string | number
  release_date?: string
  image?: string
  about?: { summary?: string | null }
  written_by?: NamedContributor[]
  cast?: NamedContributor[]
  production_credits?: Record<string, NamedContributor[] | Record<string, unknown> | undefined>
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
    const limit = Math.min((params.limit as number) || 3, 5)
    const skipCache = options?.skipCache === true

    const query = title.replace(/:/g, ' ')

    const searchRes = await httpClient.post(SEARCH_URL, { q: query, limit, offset: 0 }, { headers: SEARCH_HEADERS })

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
            const cachedData = JSON.parse(bookCache) as ParsedBookData
            if (cachedData.schemaVersion === 3) bookData = cachedData
          } catch {}
        }
      }

      if (!bookData) {
        const pageRes = await httpClient.get(productUrl, {
          headers: RSC_HEADERS,
          responseType: 'text'
        })

        if (pageRes.status === 200) {
          const rsc = typeof pageRes.data === 'string' ? pageRes.data : String(pageRes.data)
          bookData = this.parseProductPage(productUrl, rsc, hit)

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

  private parseProductPage(url: string, rsc: string, hit: BigFinishSearchResult): ParsedBookData | null {
    const releaseData = this.extractReleaseData(rsc)
    if (!releaseData) return null

    const titleParts = this.extractTitleParts(releaseData.title || hit.name)
    const narrators = this.formatNarrators(releaseData.cast)
    const narratorTags = this.extractNarratorTags(releaseData.cast)
    const authors = this.namesFrom(releaseData.written_by)
    const technicalDetails = releaseData.production_credits?.technical_details as Record<string, unknown> | undefined
    const duration =
      technicalDetails?.duration_digital_verified_minutes ||
      technicalDetails?.duration_physical_verified_minutes ||
      hit.duration
    const isbn = technicalDetails?.digital_retail_isbn || technicalDetails?.physical_retail_isbn
    const description = this.resolveRscText(rsc, releaseData.about?.summary) || hit.description || null

    return {
      schemaVersion: 3,
      url,
      title: releaseData.title || hit.name || null,
      series: this.formatSeries(releaseData.range || titleParts.series),
      seriesTag: releaseData.release_number ? String(releaseData.release_number) : titleParts.seriesTag,
      releaseDate: releaseData.release_date || null,
      about: this.appendContributors(description, releaseData),
      duration: duration ? String(duration) : null,
      writtenBy: authors.join(', ') || null,
      narratedBy: narrators.join(', ') || null,
      tags: narratorTags.length > 0 ? narratorTags : undefined,
      coverUrl: releaseData.image || hit.image || null,
      isbn: typeof isbn === 'string' ? isbn : null
    }
  }

  private extractReleaseData(rsc: string): BigFinishReleaseData | null {
    const marker = '{"releaseData":'
    const start = rsc.indexOf(marker)
    if (start === -1) return null

    let inString = false
    let escaped = false
    let depth = 0
    for (let index = start; index < rsc.length; index++) {
      const character = rsc[index]
      if (inString) {
        if (escaped) escaped = false
        else if (character === '\\') escaped = true
        else if (character === '"') inString = false
        continue
      }
      if (character === '"') inString = true
      else if (character === '{') depth++
      else if (character === '}') {
        depth--
        if (depth === 0) {
          try {
            const payload = JSON.parse(rsc.slice(start, index + 1)) as { releaseData?: BigFinishReleaseData }
            return payload.releaseData || null
          } catch {
            return null
          }
        }
      }
    }
    return null
  }

  private resolveRscText(rsc: string, value: string | null | undefined): string | null {
    if (!value) return null
    if (!/^\$[0-9a-z]+$/i.test(value)) return value

    const reference = value.slice(1)
    const record = new RegExp(`${reference}:T([0-9a-f]+),`, 'i').exec(rsc)
    if (!record || record.index === undefined) return null

    const length = parseInt(record[1], 16)
    const start = record.index + record[0].length
    return rsc.slice(start, start + length)
  }

  private namesFrom(people: NamedContributor[] | undefined): string[] {
    return [
      ...new Set((people || []).map((person) => person.name?.trim()).filter((name): name is string => Boolean(name)))
    ]
  }

  private formatNarrators(cast: NamedContributor[] | undefined): string[] {
    const narrators = this.namesFrom(cast?.filter((person) => person.label?.toLowerCase() === 'narrator'))
    const rolesByName = new Map<string, Set<string>>()

    for (const person of cast || []) {
      const name = person.name?.trim()
      const label = person.label?.trim()
      if (!name || !label || label.toLowerCase() === 'narrator') continue

      for (const role of this.splitRoleLabels(label)) {
        const roles = rolesByName.get(name) ?? new Set<string>()
        roles.add(role)
        rolesByName.set(name, roles)
      }
    }

    return narrators.map((name) => {
      const roles = Array.from(rolesByName.get(name) || []).sort()
      return roles.length > 0 ? `${name} (${roles.join(', ')})` : name
    })
  }

  private extractNarratorTags(cast: NamedContributor[] | undefined): string[] {
    const tags = new Set<string>()

    for (const person of cast || []) {
      const label = person.label?.trim()
      if (!label || label.toLowerCase() === 'narrator') continue

      for (const role of this.splitRoleLabels(label)) {
        tags.add(role)
      }
    }

    return [...tags].sort()
  }

  private splitRoleLabels(label: string): string[] {
    return [...new Set(label.split('/').map((role) => role.trim()).filter(Boolean))]
  }

  private appendContributors(description: string | null, releaseData: BigFinishReleaseData): string | null {
    const entries: string[] = []
    const add = (role: string, people: NamedContributor[] | undefined) => {
      const names = this.namesFrom(people)
      if (names.length)
        entries.push(`<li><strong>${this.escapeHtml(role)}:</strong> ${names.map(this.escapeHtml).join(', ')}</li>`)
    }

    for (const person of releaseData.cast || []) {
      if (person.label?.toLowerCase() !== 'narrator') add(person.label || 'Cast', [person])
    }
    for (const [role, people] of Object.entries(releaseData.production_credits || {})) {
      if (role !== 'writer' && Array.isArray(people)) add(this.formatRole(role), people)
    }

    if (!entries.length) return description
    return `${description || ''}<hr/><p><strong>Contributors</strong></p><ul>${entries.join('')}</ul>`
  }

  private formatRole(role: string): string {
    return role.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
  }

  private formatSeries(series: string | null | undefined): string | null {
    if (!series) return null

    const mappedSeries = SERIES_MAPPING[series.trim()] ?? series
    return mappedSeries.replace(/\s*:\s*/g, ' - ')
  }

  private escapeHtml(value: string): string {
    return value.replace(
      /[&<>"']/g,
      (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!
    )
  }

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
      isbn: data.isbn,
      tags: data.tags,
      series,
      language: 'Eng',
      publishedYear,
      publisher: 'Big Finish',
      duration
    })
  }
}
