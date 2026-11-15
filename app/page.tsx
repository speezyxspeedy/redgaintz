import EarthExplorer from '@/components/earth-explorer'
import { getOpenEvents, getTrackedSatellites } from '@/lib/nasa-data'

export const revalidate = 900

export default async function Page() {
  const [events, satellites] = await Promise.all([
    getOpenEvents().catch(() => ({ source: 'NASA EONET v3', updatedAt: new Date().toISOString(), events: [] })),
    getTrackedSatellites().catch(() => ({ source: 'CelesTrak GP / SGP4', group: 'resource', updatedAt: new Date().toISOString(), count: 0, satellites: [] })),
  ])

  return <EarthExplorer initialEvents={events} initialSatelliteData={satellites} />
}
