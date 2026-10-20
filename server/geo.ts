import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import maxmind, { type Reader, type Response } from 'maxmind'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'

export type VisitorLocation = { country: string; region: string; city: string }

type DbipCity = { city?: string; country_code?: string; state1?: string; latitude?: number; longitude?: number }
type Ring = number[][]
type Town = { county: string; town: string; polygons: Ring[][]; bbox: [number, number, number, number] }

const require = createRequire(import.meta.url)
const regionNames = new Intl.DisplayNames(['zh-TW'], { type: 'region' })

// DB-IP City Lite (CC BY 4.0). GEOIP_DIR can point at a directory holding newer
// dbip-city-ipv4.mmdb / dbip-city-ipv6.mmdb files.
function geoipDirectory() {
  if (process.env.GEOIP_DIR) return path.resolve(process.env.GEOIP_DIR)
  try { return path.dirname(require.resolve('@ip-location-db/dbip-city-mmdb/package.json')) } catch { return '' }
}

// Each database is read fully into memory (~70 MB apiece), so it is only loaded the
// first time an address of that family needs locating. GEOIP_DISABLED=1 skips it.
const readers = new Map<'v4' | 'v6', Promise<Reader<Response> | undefined>>()

function loadReader(family: 'v4' | 'v6') {
  let reader = readers.get(family)
  if (!reader) {
    const directory = process.env.GEOIP_DISABLED === '1' ? '' : geoipDirectory()
    reader = directory
      ? maxmind.open(path.join(directory, `dbip-city-ip${family}.mmdb`)).catch((error: unknown) => {
        console.warn(`GeoIP ${family} database unavailable; visitor locations will rely on proxy headers.`, error instanceof Error ? error.message : error)
        return undefined
      })
      : Promise.resolve(undefined)
    readers.set(family, reader)
  }
  return reader
}

let towns: Promise<Town[]> | undefined

// Taiwan township boundaries (Ministry of the Interior, via taiwan-atlas) for
// turning coordinates into county + township names.
function loadTowns() {
  towns ??= (async () => {
    const topology = JSON.parse(await fs.readFile(require.resolve('taiwan-atlas/towns-10t.json'), 'utf8')) as Topology<{ towns: GeometryCollection<{ COUNTYNAME: string; TOWNNAME: string }> }>
    return feature(topology, topology.objects.towns).features.flatMap((item) => {
      const geometry = item.geometry
      if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') return []
      const polygons = (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates) as Ring[][]
      const points = polygons.flatMap((polygon) => polygon[0] ?? [])
      const xs = points.map((point) => point[0] ?? 0)
      const ys = points.map((point) => point[1] ?? 0)
      return [{ county: item.properties.COUNTYNAME, town: item.properties.TOWNNAME, polygons, bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as Town['bbox'] }]
    })
  })()
  return towns
}

function insideRing(x: number, y: number, ring: Ring) {
  let inside = false
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [xi = 0, yi = 0] = ring[index] ?? []
    const [xj = 0, yj = 0] = ring[previous] ?? []
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

export async function findTaiwanTown(longitude: number, latitude: number) {
  for (const town of await loadTowns()) {
    const [minX, minY, maxX, maxY] = town.bbox
    if (longitude < minX || longitude > maxX || latitude < minY || latitude > maxY) continue
    const hit = town.polygons.some(([outer, ...holes]) => outer && insideRing(longitude, latitude, outer) && !holes.some((hole) => insideRing(longitude, latitude, hole)))
    if (hit) return { county: town.county, town: town.town }
  }
  return null
}

// GeoIP places many Taiwanese addresses at a default point for the whole city
// (e.g. "Taipei"). Those coordinates say nothing about the township, so only the
// county is reported for them.
const countyLevelNames = new Set([
  'taipei', 'new taipei', 'taoyuan', 'taichung', 'tainan', 'kaohsiung', 'keelung', 'hsinchu', 'chiayi', 'miaoli', 'changhua',
  'nantou', 'yunlin', 'pingtung', 'yilan', 'hualien', 'taitung', 'penghu', 'kinmen', 'lienchiang', 'matsu', 'taiwan',
])

export function isCountyLevelName(name: string) {
  return countyLevelNames.has(name.toLowerCase().replace(/\b(city|county)\b/g, '').replace(/[-\s]+/g, ' ').trim())
}

export async function taiwanLocation(longitude: number, latitude: number, cityName: string): Promise<Pick<VisitorLocation, 'region' | 'city'> | null> {
  const town = await findTaiwanTown(longitude, latitude)
  if (!town) return null
  return { region: town.county, city: cityName && isCountyLevelName(cityName) ? '' : town.town }
}

function countryName(code: string) {
  const name = /^[A-Z]{2}$/.test(code) && code !== 'XX' && code !== 'T1' ? regionNames.of(code) : undefined
  return name && name !== code ? name : ''
}

function cleanText(value: string | undefined) {
  return [...value ?? ''].filter((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127).join('').trim().slice(0, 80)
}

const cache = new Map<string, Promise<VisitorLocation | null>>()

// Proxy headers win when present (from a trusted proxy); the local GeoIP database
// fills in anything they do not provide. Taiwanese locations resolve to county
// and township names in Chinese.
export function locateVisitor(ip: string, headers: { country?: string; region?: string; city?: string; latitude?: string; longitude?: string } = {}) {
  const key = `${ip}|${Object.values(headers).join('|')}`
  let result = cache.get(key)
  if (!result) {
    result = resolveLocation(ip, headers).catch(() => null)
    if (cache.size >= 5000) cache.delete(cache.keys().next().value as string)
    cache.set(key, result)
  }
  return result
}

async function resolveLocation(ip: string, headers: { country?: string; region?: string; city?: string; latitude?: string; longitude?: string }): Promise<VisitorLocation | null> {
  const reader = maxmind.validate(ip) ? await loadReader(ip.includes(':') ? 'v6' : 'v4') : undefined
  // DB-IP records are flat ({ city, state1, ... }) rather than MaxMind's nested shape.
  const record = (reader?.get(ip) as DbipCity | null | undefined) ?? undefined
  const countryCode = (headers.country || record?.country_code || '').trim().toUpperCase()
  const country = countryName(countryCode)
  if (!country) return null

  const headerLatitude = Number(headers.latitude)
  const headerLongitude = Number(headers.longitude)
  const hasHeaderPoint = headers.latitude && headers.longitude && Number.isFinite(headerLatitude) && Number.isFinite(headerLongitude)
  const latitude = hasHeaderPoint ? headerLatitude : record?.latitude
  const longitude = hasHeaderPoint ? headerLongitude : record?.longitude
  const cityName = cleanText(headers.city || record?.city)

  if (countryCode === 'TW' && typeof latitude === 'number' && typeof longitude === 'number') {
    const local = await taiwanLocation(longitude, latitude, cityName)
    if (local) return { country, ...local }
  }
  const rawRegion = cleanText(headers.region || record?.state1)
  // DB-IP often reports the whole country ("Taiwan") as the state; that adds nothing.
  const region = rawRegion.toLowerCase() === 'taiwan' ? '' : rawRegion
  return { country, region, city: cityName && cityName !== region ? cityName : '' }
}
