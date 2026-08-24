import { BaseProvider } from '../BaseProvider'
import { BookMetadata, ParsedParameters, ProviderConfig } from '../../types'
import { normalizeBookMetadata } from '../../utils/helpers'
import { httpClient } from '../../utils/httpClient'
import {
  CacheMeta,
  DreifragData,
  DreifragEpisode,
  DreifragKidsData,
  DreifragScoredItem,
  DreifragSource,
  DreifragSpezialData,
  DreifragSpezialEpisode
} from './types'
import path from 'path'
import fs from 'fs'

const configPath = path.join(__dirname, 'config.json')
const config: ProviderConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'))

const CACHE_DIR = path.join(process.cwd(), 'data')
const CHECK_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000

const SOURCES: { key: DreifragSource; url: string; dataField: string }[] = [
  { key: 'serie', url: 'https://dreimetadaten.de/data/Serie.json', dataField: 'serie' },
  { key: 'spezial', url: 'https://dreimetadaten.de/data/Spezial.json', dataField: 'spezial' },
  { key: 'kids', url: 'https://dreimetadaten.de/data/Kids.json', dataField: 'kids' }
]

function cachePaths(key: DreifragSource): { data: string; meta: string } {
  return {
    data: path.join(CACHE_DIR, `dreifragezeichen_${key}.json`),
    meta: path.join(CACHE_DIR, `dreifragezeichen_${key}_meta.json`)
  }
}

export default class DreifragezeichenProvider extends BaseProvider {
  private collections: Record<DreifragSource, (DreifragEpisode | DreifragSpezialEpisode)[]> = {
    serie: [],
    spezial: [],
    kids: []
  }
  private loadedAt: Record<DreifragSource, number> = { serie: 0, spezial: 0, kids: 0 }

  constructor() {
    super(config)
  }

  private async loadCollection(source: DreifragSource): Promise<void> {
    const now = Date.now()

    if (this.collections[source].length > 0 && now - this.loadedAt[source] < CHECK_INTERVAL_MS) {
      return
    }

    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true })
    }

    const { data: dataFile, meta: metaFile } = cachePaths(source)
    const { url, dataField } = SOURCES.find((s) => s.key === source)!

    let meta: CacheMeta = { lastChecked: 0 }
    if (fs.existsSync(metaFile)) {
      try {
        meta = JSON.parse(fs.readFileSync(metaFile, 'utf-8'))
      } catch {
        meta = { lastChecked: 0 }
      }
    }

    const fileExists = fs.existsSync(dataFile)
    const weekElapsed = now - meta.lastChecked >= CHECK_INTERVAL_MS

    if (!fileExists || weekElapsed) {
      try {
        const headResponse = await httpClient.head(url)
        const remoteEtag = headResponse.headers['etag'] as string | undefined
        const etagChanged = remoteEtag && remoteEtag !== meta.etag

        if (!fileExists || etagChanged) {
          const response = await httpClient.get<DreifragData | DreifragSpezialData | DreifragKidsData>(url, {
            headers: { Accept: 'application/json' },
            responseType: 'json'
          })

          if (response.status === 200 && response.data && dataField in response.data) {
            fs.writeFileSync(dataFile, JSON.stringify(response.data), 'utf-8')
          } else if (!fileExists) {
            throw new Error(`Failed to download Die drei ??? ${source} data: HTTP ${response.status}`)
          }
        }

        meta.etag = remoteEtag ?? meta.etag
        meta.lastChecked = now
        fs.writeFileSync(metaFile, JSON.stringify(meta), 'utf-8')
      } catch (err) {
        if (!fileExists) throw err
        console.error(`DreifragezeichenProvider: failed to check for ${source} updates, using cached data:`, err)
      }
    }

    const raw = fs.readFileSync(dataFile, 'utf-8')
    const parsed = JSON.parse(raw)
    this.collections[source] = Array.isArray(parsed[dataField]) ? parsed[dataField] : []
    this.loadedAt[source] = now
  }

  private async loadAll(): Promise<void> {
    await Promise.all(SOURCES.map((s) => this.loadCollection(s.key)))
  }

  private normalizeStr(s: string): string {
    return s
      .toLowerCase()
      .replace(/ä/g, 'a')
      .replace(/ö/g, 'o')
      .replace(/ü/g, 'u')
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  private extractNumber(s: string): number | null {
    const match = s.match(/\b(\d+)\b/)
    return match ? parseInt(match[1], 10) : null
  }

  private scoreEpisode(query: string, ep: DreifragEpisode | DreifragSpezialEpisode, source: DreifragSource): number {
    let score = 0
    const queryNorm = this.normalizeStr(query)
    const titleNorm = this.normalizeStr(ep.titel ?? '')
    const sourceKeyword: Record<DreifragSource, string> = { serie: 'serie', spezial: 'spezial', kids: 'kids' }

    if (queryNorm.includes(sourceKeyword[source])) {
      score += 300
    } else if (
      (queryNorm.includes('spezial') && source !== 'spezial') ||
      (queryNorm.includes('kids') && source !== 'kids')
    ) {
      score -= 200
    }

    const nummer = (ep as DreifragEpisode).nummer ?? null
    const queryNumber = this.extractNumber(queryNorm)
    if (queryNumber !== null && nummer !== null) {
      if (queryNumber === nummer) {
        score += 1000
      } else {
        score -= 50
      }
    }

    const prefix =
      source === 'serie'
        ? 'die drei fragezeichen'
        : source === 'spezial'
          ? 'die drei fragezeichen spezial'
          : 'die drei fragezeichen kids'
    const fullTitleNorm = this.normalizeStr(`${prefix} ${nummer ?? ''} ${ep.titel}`)

    if (titleNorm.includes(queryNorm) || fullTitleNorm.includes(queryNorm)) {
      score += 200
    }

    const queryWords = queryNorm.split(/\s+/).filter((w) => w.length > 2 && !/^\d+$/.test(w))
    for (const word of queryWords) {
      if (sourceKeyword[source] === word) continue
      if (titleNorm.includes(word)) {
        score += 30
      } else if (word.length >= 4) {
        for (const tw of titleNorm.split(/\s+/)) {
          if (tw.startsWith(word.slice(0, Math.max(4, Math.floor(word.length * 0.75))))) {
            score += 10
            break
          }
        }
      }
    }

    return score
  }

  async search(
    title: string,
    _author: string | null,
    params: ParsedParameters,
    _options?: { skipCache?: boolean }
  ): Promise<BookMetadata[]> {
    const limit = params.limit ? Number(params.limit) : 5
    await this.loadAll()

    const scored: DreifragScoredItem[] = []
    for (const { key } of SOURCES) {
      for (const ep of this.collections[key]) {
        const score = this.scoreEpisode(title, ep, key)
        if (score > 0) {
          scored.push({ source: key, score, ep })
        }
      }
    }

    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, limit).map(({ ep, source }) => this.mapToMetadata(ep, source))
  }

  async getBookById(bookId: string, _params: ParsedParameters): Promise<BookMetadata | null> {
    await this.loadAll()

    for (const { key } of SOURCES) {
      const ep = this.collections[key].find((e) => {
        const numbered = e as DreifragEpisode
        return numbered.nummer !== undefined ? String(numbered.nummer) === bookId : false
      })
      if (ep) return this.mapToMetadata(ep, key)
    }

    return null
  }

  private mapToMetadata(ep: DreifragEpisode | DreifragSpezialEpisode, source: DreifragSource): BookMetadata {
    const nummer = (ep as DreifragEpisode).nummer
    const seriesName =
      source === 'serie' ? 'Die drei ???' : source === 'spezial' ? 'Die drei ??? Spezial' : 'Die drei ??? Kids'

    const paddedNumber = nummer !== undefined ? String(nummer).padStart(3, '0') : undefined
    const fullTitle = ep.titel ?? ''
    const subtitle = paddedNumber ? `${seriesName} ${paddedNumber}` : seriesName

    const narrator = ep.sprechrollen
      ? ep.sprechrollen
          .map((r) => r.sprecher)
          .filter((v, i, a) => a.indexOf(v) === i)
          .join(', ')
      : undefined

    let publishedYear: string | undefined
    if (ep.veröffentlichungsdatum) {
      const year = ep.veröffentlichungsdatum.slice(0, 4)
      if (/^\d{4}$/.test(year)) publishedYear = year
    }

    const duration = ep.gesamtdauer ? Math.round(ep.gesamtdauer / 1000) : undefined
    const cover = ep.links?.cover_itunes
    const seriesEntry = nummer !== undefined ? { series: seriesName, sequence: String(nummer) } : { series: seriesName }

    return normalizeBookMetadata({
      title: fullTitle,
      subtitle,
      author: ep.autor,
      narrator,
      description: ep.gesamtbeschreibung ?? ep.beschreibung,
      cover,
      publishedYear,
      series: [seriesEntry],
      duration: duration !== undefined ? duration / 60 : undefined,
      language: 'de',
      poweredBy: 'dreimetadaten.de'
    })
  }
}
