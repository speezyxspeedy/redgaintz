import { NextRequest, NextResponse } from 'next/server'

type NominatimResult = {
  place_id: number
  lat: string
  lon: string
  display_name: string
  type: string
  addresstype?: string
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (query.length < 3 || query.length > 120) {
    return NextResponse.json({ error: 'Search text must be between 3 and 120 characters.' }, { status: 400 })
  }

  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('limit', '6')

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'EarthTrends/1.0 (geographic place search)' },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 3600 },
    })
    if (!response.ok) throw new Error('OpenStreetMap location search is unavailable.')
    const results = await response.json() as NominatimResult[]
    const locations = results.filter((result) => Number.isFinite(Number(result.lat)) && Number.isFinite(Number(result.lon))).map((result) => ({
      id: String(result.place_id),
      name: result.display_name.split(',').slice(0, 3).join(', '),
      displayName: result.display_name,
      lat: Number(result.lat),
      lng: Number(result.lon),
      type: result.addresstype ?? result.type,
    }))
    return NextResponse.json({ locations }, { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' } })
  } catch {
    return NextResponse.json({ error: 'Location search is temporarily unavailable.' }, { status: 502 })
  }
}