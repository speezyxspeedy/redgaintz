import * as satellite from 'satellite.js'

export type EarthEvent = {
  id: string
  title: string
  description: string | null
  link: string
  closed: string | null
  categories: { title: string }[]
  sources: { url: string }[]
  geometry: { date: string }[]
}

export type EventsPayload = {
  source: string
  updatedAt: string
  events: EarthEvent[]
}

export type Spacecraft = {
  name: string
  noradId: number
  latitude: number
  longitude: number
  altitudeKm: number
  inclination: number
}

export type SatellitesPayload = {
  source: string
  group: string
  updatedAt: string
  count: number
  satellites: Spacecraft[]
}

export async function getOpenEvents(): Promise<EventsPayload> {
  const response = await fetch('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=50', {
    next: { revalidate: 600 },
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw new Error('NASA EONET is temporarily unavailable.')

  const payload = await response.json()
  return {
    source: 'NASA EONET v3',
    updatedAt: new Date().toISOString(),
    events: Array.isArray(payload.events) ? payload.events.map((event: EarthEvent) => ({
      id: event.id,
      title: event.title,
      description: event.description,
      link: event.link,
      closed: event.closed,
      categories: event.categories,
      sources: event.sources,
      geometry: event.geometry,
    })) : [],
  }
}

export async function getTrackedSatellites(): Promise<SatellitesPayload> {
  const response = await fetch('https://celestrak.org/NORAD/elements/gp.php?GROUP=resource&FORMAT=tle', {
    next: { revalidate: 900 },
    headers: { Accept: 'text/plain', 'User-Agent': 'Earth Observatory Explorer/1.0' },
  })
  if (!response.ok) throw new Error('CelesTrak is temporarily unavailable.')

  const lines = (await response.text()).split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const now = new Date()
  const spacecraft: Spacecraft[] = []

  for (let index = 0; index + 2 < lines.length; index += 3) {
    const [name, line1, line2] = lines.slice(index, index + 3)
    if (!line1.startsWith('1 ') || !line2.startsWith('2 ')) continue

    try {
      const record = satellite.twoline2satrec(line1, line2)
      const propagated = satellite.propagate(record, now)
      if (!propagated) continue
      const geodetic = satellite.eciToGeodetic(propagated.position, satellite.gstime(now))
      const latitude = satellite.degreesLat(geodetic.latitude)
      const longitude = satellite.degreesLong(geodetic.longitude)
      const altitudeKm = Math.round(geodetic.height)
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || altitudeKm < 0 || altitudeKm > 50000) continue

      spacecraft.push({
        name: name.trim(),
        noradId: Number(line1.slice(2, 7)),
        latitude: Number(latitude.toFixed(2)),
        longitude: Number(longitude.toFixed(2)),
        altitudeKm,
        inclination: Number(satellite.radiansToDegrees(record.inclo).toFixed(2)),
      })
    } catch {
      continue
    }
  }

  return {
    source: 'CelesTrak GP / SGP4',
    group: 'resource',
    updatedAt: now.toISOString(),
    count: spacecraft.length,
    satellites: spacecraft.slice(0, 120),
  }
}
