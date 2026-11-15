import { NextRequest, NextResponse } from 'next/server'

const analysisKinds = new Set(['ndvi', 'deforestation', 'land-cover', 'temperature', 'change-detection'])
const maxYear = new Date().getUTCFullYear()
type AnalysisRouteContext = { params: Promise<{ kind: string }> }
type PolygonGeometry = { type: string; coordinates: number[][][] }

function serviceUrl(path: string) {
  const baseUrl = process.env.EARTH_ENGINE_API_URL
  if (!baseUrl) return null
  return new URL(`/api/analysis/${path}`, baseUrl)
}

function backendHeaders() {
  const headers = new Headers({ Accept: 'application/json' })
  const token = process.env.EARTH_ENGINE_API_TOKEN
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return headers
}

function errorResponse(message: string, status: number, error: string) {
  return NextResponse.json({ error, message }, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest, { params }: AnalysisRouteContext) {
  const { kind } = await params
  if (!analysisKinds.has(kind)) return errorResponse('Unsupported analysis type.', 404, 'unsupported_analysis')
  const url = serviceUrl(kind)
  if (!url) return errorResponse('Earth Engine is not configured. Set EARTH_ENGINE_API_URL to an authenticated analysis service.', 503, 'analysis_backend_not_configured')
  if (Number(request.headers.get('content-length') ?? 0) > 1_000_000) return errorResponse('Analysis request is too large.', 413, 'request_too_large')

  let body: { geometry?: PolygonGeometry; baselineYear?: number; comparisonYear?: number }
  try {
    body = await request.json()
  } catch {
    return errorResponse('Request body must be valid JSON.', 400, 'invalid_json')
  }

  const ring = body.geometry?.coordinates?.[0]
  if (body.geometry?.type !== 'Polygon' || !Array.isArray(ring) || ring.length < 4 || ring.length > 256 || ring.some(([lng, lat]) => !Number.isFinite(lng) || !Number.isFinite(lat) || Math.abs(lng) > 180 || Math.abs(lat) > 90)) {
    return errorResponse('Provide a valid GeoJSON Polygon analysis area.', 400, 'invalid_geometry')
  }
  if (!Number.isInteger(body.baselineYear) || !Number.isInteger(body.comparisonYear) || body.baselineYear! < 1984 || body.comparisonYear! > maxYear || body.baselineYear! >= body.comparisonYear!) {
    return errorResponse(`Years must be ordered whole years from 1984 through ${maxYear}.`, 400, 'invalid_year_range')
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: new Headers({ ...Object.fromEntries(backendHeaders()), 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(120_000),
    })
    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('application/json')) return errorResponse('Earth Engine service returned an unsupported response.', 502, 'invalid_analysis_response')
    return new NextResponse(await response.text(), { status: response.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
  } catch {
    return errorResponse('Unable to reach the Earth Engine analysis service.', 502, 'analysis_service_unavailable')
  }
}

export async function GET(_request: NextRequest, { params }: AnalysisRouteContext) {
  const { kind } = await params
  if (kind !== 'history') return errorResponse('Unsupported analysis endpoint.', 404, 'unsupported_analysis')
  const url = serviceUrl('history')
  if (!url) return errorResponse('Analysis history requires a configured Earth Engine service and user database.', 503, 'analysis_backend_not_configured')

  try {
    const response = await fetch(url, { headers: backendHeaders(), cache: 'no-store', signal: AbortSignal.timeout(15_000) })
    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('application/json')) return errorResponse('Analysis service returned an unsupported response.', 502, 'invalid_analysis_response')
    return new NextResponse(await response.text(), { status: response.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
  } catch {
    return errorResponse('Unable to reach analysis history.', 502, 'analysis_service_unavailable')
  }
}