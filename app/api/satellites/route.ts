import { NextResponse } from 'next/server'
import { getTrackedSatellites } from '@/lib/nasa-data'

export const revalidate = 900

export async function GET() {
  try {
    const payload = await getTrackedSatellites()
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800' },
    })
  } catch {
    return NextResponse.json({ error: 'Unable to reach CelesTrak.' }, { status: 502 })
  }
}
