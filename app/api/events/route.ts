import { NextResponse } from 'next/server'
import { getOpenEvents } from '@/lib/nasa-data'

export const revalidate = 600

export async function GET() {
  try {
    const payload = await getOpenEvents()
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800' },
    })
  } catch {
    return NextResponse.json({ error: 'Unable to reach NASA EONET.' }, { status: 502 })
  }
}
