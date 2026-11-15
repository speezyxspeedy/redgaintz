'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import EarthGlobe from '@/components/earth-globe'
import CesiumEarthGlobe from '@/components/cesium-earth-globe'
import GoogleEarthGlobe, { type GlobeLocation, type GoogleCameraCommand } from '@/components/google-earth-globe'
import type { EventsPayload, SatellitesPayload } from '@/lib/nasa-data'
import { Activity, ArrowLeft, ArrowRight, Bookmark, Check, ChevronDown, ChevronRight, CircleHelp, Compass, Crosshair, Expand, Globe2, History, Layers, Leaf, MapPin, Menu, Mountain, Pause, Play, RotateCcw, Search, Settings2, Share2, Satellite, Sun, Thermometer, Trees, X, ZoomIn, ZoomOut } from 'lucide-react'

const layers = ['Satellites Now', 'Visible Earth', 'Air Temperature', 'Carbon Dioxide', 'Carbon Monoxide', 'Chlorophyll', 'Precipitation', 'Sea Level', 'Sea Surface Temperature', 'Soil Moisture', 'Ozone', 'Water Vapor', 'Water Storage', 'Nitrous Oxide']
const fetcher = (url: string) => fetch(url).then((response) => {
  if (!response.ok) throw new Error('NASA event feed is unavailable')
  return response.json()
})
type EonetEvent = { title: string; categories: { title: string }[]; geometry: { date: string }[]; sources?: { url: string }[] }
type EonetResponse = { events: EonetEvent[] }
type Spacecraft = { name: string; noradId: number; latitude: number; longitude: number; altitudeKm: number; inclination: number }
type SatelliteResponse = { source: string; updatedAt: string; count: number; satellites: Spacecraft[] }
type LocationResult = { id: string; name: string; displayName: string; lat: number; lng: number; type: string }
type AnalysisKind = 'ndvi' | 'deforestation' | 'land-cover' | 'temperature' | 'change-detection'
type AnalysisResponse = { status?: string; jobId?: string; dataset?: string; measurements?: Record<string, number | string>; insights?: string[]; message?: string; error?: string }
type SavedLocation = Pick<LocationResult, 'id' | 'name' | 'lat' | 'lng'>
type AnalysisHistoryEntry = { jobId: string; analysis: string; status: string; createdAt: string }
const satelliteColors = ['#7dd3fc', '#c084fc', '#fbbf24', '#34d399', '#fb7185', '#a3e635']
const analysisOptions: { id: AnalysisKind; label: string }[] = [
  { id: 'ndvi', label: 'Vegetation health · NDVI' },
  { id: 'deforestation', label: 'Deforestation' },
  { id: 'land-cover', label: 'Land cover' },
  { id: 'temperature', label: 'Land surface temperature' },
  { id: 'change-detection', label: 'Historical change detection' },
]

function circularArea(lat: number, lng: number, radiusKm: number) {
  const earthRadiusKm = 6371.0088
  const angularRadius = radiusKm / earthRadiusKm
  const latitude = lat * Math.PI / 180
  const longitude = lng * Math.PI / 180
  const ring = Array.from({ length: 65 }, (_, index) => {
    const bearing = index * 2 * Math.PI / 64
    const destinationLatitude = Math.asin(Math.sin(latitude) * Math.cos(angularRadius) + Math.cos(latitude) * Math.sin(angularRadius) * Math.cos(bearing))
    const destinationLongitude = longitude + Math.atan2(Math.sin(bearing) * Math.sin(angularRadius) * Math.cos(latitude), Math.cos(angularRadius) - Math.sin(latitude) * Math.sin(destinationLatitude))
    return [destinationLongitude * 180 / Math.PI, destinationLatitude * 180 / Math.PI]
  })
  return { type: 'Polygon', coordinates: [ring] }
}

type EarthExplorerProps = { initialEvents: EventsPayload; initialSatelliteData: SatellitesPayload }

export default function EarthExplorer({ initialEvents, initialSatelliteData }: EarthExplorerProps) {
  const [activeLayer, setActiveLayer] = useState('Satellites Now')
  const [selectedMission, setSelectedMission] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [showMissions, setShowMissions] = useState(true)
  const [showLayerMenu, setShowLayerMenu] = useState(false)
  const [showEvent, setShowEvent] = useState(true)
  const [search, setSearch] = useState('')
  const [time, setTime] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [brightView, setBrightView] = useState(false)
  const [panelOpen, setPanelOpen] = useState(true)
  const [viewReset, setViewReset] = useState(0)
  const [layerFallback, setLayerFallback] = useState(false)
  const [locationQuery, setLocationQuery] = useState('')
  const [locationResults, setLocationResults] = useState<LocationResult[]>([])
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [locationSearchOpen, setLocationSearchOpen] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<LocationResult | null>(null)
  const [locationFocus, setLocationFocus] = useState<GlobeLocation | null>(null)
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([])
  const [showSavedLocations, setShowSavedLocations] = useState(false)
  const [analysisKind, setAnalysisKind] = useState<AnalysisKind>('ndvi')
  const [baselineYear, setBaselineYear] = useState('2017')
  const [comparisonYear, setComparisonYear] = useState('2023')
  const [areaRadiusKm, setAreaRadiusKm] = useState('10')
  const [analysisBusy, setAnalysisBusy] = useState(false)
  const [analysisStatus, setAnalysisStatus] = useState('')
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null)
  const [analysisHistory, setAnalysisHistory] = useState<AnalysisHistoryEntry[]>([])
  const [googleMapFailed, setGoogleMapFailed] = useState(false)
  const [cesiumMapFailed, setCesiumMapFailed] = useState(false)
  const [cesiumStatus, setCesiumStatus] = useState('')
  const [mapEngine, setMapEngine] = useState<'cesium' | 'google' | 'three'>('cesium')
  const [mapMode, setMapMode] = useState<'SATELLITE' | 'HYBRID'>('SATELLITE')
  const [cameraCommand, setCameraCommand] = useState<GoogleCameraCommand>({ id: 0, action: 'reset' })
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''
  const cesiumIonToken = process.env.NEXT_PUBLIC_CESIUM_ION_ACCESS_TOKEN ?? ''
  const showGoogleMap = mapEngine === 'google' && Boolean(googleMapsApiKey) && !googleMapFailed
  const showCesiumMap = mapEngine === 'cesium' && !cesiumMapFailed
  const { data: nasaEvents, error: eventsError } = useSWR<EonetResponse>('/api/events', fetcher, { fallbackData: initialEvents, refreshInterval: 600000, revalidateOnFocus: true })
  const { data: satelliteData, error: satelliteError } = useSWR<SatelliteResponse>('/api/satellites', fetcher, { fallbackData: initialSatelliteData, refreshInterval: 30000, revalidateOnFocus: true })
  const latestEvent = nasaEvents?.events?.[0]
  const missions = (satelliteData?.satellites ?? []).map((spacecraft, index) => ({
    ...spacecraft,
    color: satelliteColors[index % satelliteColors.length],
    detail: `NORAD catalog ID ${spacecraft.noradId}`,
    altitude: `${spacecraft.altitudeKm.toLocaleString()} km`,
    orbit: `${spacecraft.inclination.toFixed(1)}°`,
  }))
  const selected = missions.find((mission) => mission.noradId === selectedMission) ?? missions[0]

  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => setTime((value) => value <= -30 ? 0 : value - 1), 3000)
    return () => window.clearInterval(timer)
  }, [playing])

  useEffect(() => {
    const query = locationQuery.trim()
    if (query.length < 3) {
      setLocationResults([])
      setLocationLoading(false)
      setLocationError('')
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLocationLoading(true)
      setLocationError('')
      try {
        const response = await fetch(`/api/locations/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error ?? 'Location search is unavailable.')
        setLocationResults(payload.locations)
      } catch (error) {
        if (!controller.signal.aborted) setLocationError(error instanceof Error ? error.message : 'Location search is unavailable.')
      } finally {
        if (!controller.signal.aborted) setLocationLoading(false)
      }
    }, 1000)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [locationQuery])

  useEffect(() => {
    try {
      const saved = localStorage.getItem('earth-trends:saved-locations')
      if (saved) setSavedLocations(JSON.parse(saved) as SavedLocation[])
    } catch {
      setSavedLocations([])
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('earth-trends:saved-locations', JSON.stringify(savedLocations))
  }, [savedLocations])

  const selectedDate = new Date(Date.now() + time * 86400000).toISOString().slice(0, 10)
  const formatDate = (offset: number) => new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(Date.now() + offset * 86400000))
  const issueCameraCommand = (action: GoogleCameraCommand['action']) => setCameraCommand((current) => ({ id: current.id + 1, action }))

  const selectLocation = (location: LocationResult | SavedLocation) => {
    const displayName = 'displayName' in location ? location.displayName : location.name
    setSelectedLocation({ ...location, displayName, type: 'type' in location ? location.type : 'saved location' })
    setLocationQuery(location.name)
    setLocationResults([])
    setLocationSearchOpen(false)
    setShowSavedLocations(false)
    setLocationFocus({ lat: location.lat, lng: location.lng, token: Date.now(), name: location.name, displayName })
    setAnalysisStatus('')
  }

  const saveSelectedLocation = () => {
    if (!selectedLocation) return
    setSavedLocations((current) => current.some((location) => location.id === selectedLocation.id) ? current : [...current, { id: selectedLocation.id, name: selectedLocation.name, lat: selectedLocation.lat, lng: selectedLocation.lng }])
  }

  const runAnalysis = async () => {
    if (!selectedLocation) {
      setAnalysisStatus('Search for and select a location before running an analysis.')
      return
    }
    const radiusKm = Number(areaRadiusKm)
    if (!Number.isFinite(radiusKm) || radiusKm < 1 || radiusKm > 100) {
      setAnalysisStatus('Area radius must be between 1 and 100 km.')
      return
    }
    setAnalysisBusy(true)
    setAnalysisStatus('Submitting analysis to the configured Earth Engine service…')
    setAnalysisResult(null)
    try {
      const response = await fetch(`/api/analysis/${analysisKind}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geometry: circularArea(selectedLocation.lat, selectedLocation.lng, radiusKm),
          baselineYear: Number(baselineYear),
          comparisonYear: Number(comparisonYear),
        }),
      })
      const payload = await response.json() as AnalysisResponse
      if (!response.ok) throw new Error(payload.message ?? 'The Earth Engine analysis could not be completed.')
      setAnalysisResult(payload)
      setAnalysisStatus(payload.status === 'queued' ? `Analysis job queued${payload.jobId ? ` · ${payload.jobId}` : ''}.` : 'Analysis complete. Results below are returned by the configured service.')
    } catch (error) {
      setAnalysisStatus(error instanceof Error ? error.message : 'The Earth Engine analysis could not be completed.')
    } finally {
      setAnalysisBusy(false)
    }
  }

  const loadAnalysisHistory = async () => {
    setPanelOpen(true)
    setAnalysisStatus('Loading analysis history…')
    try {
      const response = await fetch('/api/analysis/history')
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.message ?? 'Analysis history is unavailable.')
      setAnalysisHistory(payload.history ?? [])
      setAnalysisStatus('Analysis history loaded from the configured service.')
    } catch (error) {
      setAnalysisStatus(error instanceof Error ? error.message : 'Analysis history is unavailable.')
    }
  }

  return (
    <main className="earth-app">
      <header className="topbar">
        <div className="brand-lockup">
          <button className="mobile-menu icon-button" aria-label="Open menu" onClick={() => setMenuOpen(!menuOpen)}><Menu size={18} /></button>
          <a className="brand-mark" href="#home" aria-label="Earth Observatory home"><Globe2 size={21} strokeWidth={1.5} /></a>
          <div className="brand-title"><span>EARTH TRENDS</span><small>PLANETARY INTELLIGENCE</small></div>
        </div>
        <div className="location-search">
          <Search size={16} />
          <input value={locationQuery} onFocus={() => setLocationSearchOpen(true)} onChange={(event) => setLocationQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && locationResults[0]) selectLocation(locationResults[0]); if (event.key === 'Escape') setLocationSearchOpen(false) }} placeholder="Search countries, cities, places" aria-label="Search geographic locations" aria-expanded={locationSearchOpen && locationResults.length > 0} />
          {locationLoading && <span className="search-spinner" aria-label="Searching" />}
          {locationSearchOpen && locationResults.length > 0 && <div className="location-suggestions" role="listbox">{locationResults.map((location) => <button key={location.id} role="option" aria-selected="false" onClick={() => selectLocation(location)}><MapPin size={14} /><span><b>{location.name}</b><small>{location.displayName}</small></span></button>)}<small className="location-attribution">Search by OpenStreetMap contributors</small></div>}
          {locationSearchOpen && locationError && <div className="location-suggestions location-error" role="status">{locationError}</div>}
        </div>
        <div className="map-engine-switch" role="group" aria-label="3D globe engine">
          <button className={mapEngine === 'cesium' ? 'engine-active' : ''} aria-pressed={mapEngine === 'cesium'} onClick={() => { setMapEngine('cesium'); setCesiumMapFailed(false) }}>Cesium</button>
          <button className={mapEngine === 'google' ? 'engine-active' : ''} aria-pressed={mapEngine === 'google'} disabled={!googleMapsApiKey} title={googleMapsApiKey ? 'Use Google Maps 3D' : 'Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable'} onClick={() => { setMapEngine('google'); setGoogleMapFailed(false) }}>Google 3D</button>
          <button className={mapEngine === 'three' ? 'engine-active' : ''} aria-pressed={mapEngine === 'three'} onClick={() => setMapEngine('three')}>NASA</button>
        </div>
        <nav className={menuOpen ? 'main-nav open' : 'main-nav'} aria-label="Main navigation">
          <a className="nav-active" href="#home"><span className="nav-dot" /> Explore</a>
          <a href="#layers">Data layers</a><a href="#missions">Missions</a><a href="#events">Events</a>
        </nav>
        <div className="top-actions"><span className="live-indicator"><i /> LIVE DATA</span><a className="icon-button" href="https://www.earthdata.nasa.gov/data/tools/worldview" target="_blank" rel="noreferrer" aria-label="NASA Worldview help"><CircleHelp size={17} /></a><button className="icon-button panel-toggle" aria-label={panelOpen ? 'Hide data panel' : 'Show data panel'} aria-pressed={panelOpen} onClick={() => setPanelOpen(!panelOpen)}><Layers size={17} /></button><button className="share-button" onClick={() => navigator.clipboard?.writeText(window.location.href)}><Share2 size={14} /> Share</button></div>
      </header>

      <section className="workspace" id="home">
        <nav className="earth-rail" aria-label="Earth tools">
          <button className="earth-rail-active" aria-label="Explore" title="Explore"><Globe2 size={17} /></button>
          <button aria-label="Environmental monitoring" title="Environmental monitoring" onClick={() => { setAnalysisKind('ndvi'); setPanelOpen(true) }}><Leaf size={17} /></button>
          <button aria-label="Satellite analysis" title="Satellite analysis" onClick={() => { setActiveLayer('Satellites Now'); setPanelOpen(true) }}><Satellite size={17} /></button>
          <button aria-label="Historical comparison" title="Historical comparison" onClick={() => { setAnalysisKind('change-detection'); setPanelOpen(true) }}><History size={17} /></button>
          <button aria-label="Saved locations" title="Saved locations" aria-pressed={showSavedLocations} onClick={() => setShowSavedLocations(!showSavedLocations)}><Bookmark size={17} /></button>
          <button aria-label="Analysis history" title="Analysis history" onClick={loadAnalysisHistory}><Activity size={17} /></button>
        </nav>
        <div className={brightView ? 'globe-scene bright-view' : 'globe-scene'} aria-label="Interactive Earth visualization">
          <div className="starfield" />
          {showGoogleMap ? <GoogleEarthGlobe apiKey={googleMapsApiKey} satellites={missions} selectedMission={selectedMission} location={locationFocus} cameraCommand={cameraCommand} mode={mapMode} onSelectMission={setSelectedMission} onCenterChange={(center) => setLocationFocus((current) => current ? { ...current, lat: center.lat, lng: center.lng } : { ...center, token: Date.now() })} onError={() => { setGoogleMapFailed(true); setMapEngine('cesium') }} /> : showCesiumMap ? <CesiumEarthGlobe baseTextureUrl={`/api/earth-layer?layer=Visible%20Earth&date=${selectedDate}`} textureUrl={`/api/earth-layer?layer=${encodeURIComponent(activeLayer)}&date=${selectedDate}`} imageryDate={selectedDate} overlayEnabled={activeLayer !== 'Visible Earth'} ionAccessToken={cesiumIonToken} satellites={missions} selectedMission={selectedMission} location={locationFocus} cameraCommand={cameraCommand} onSelectMission={setSelectedMission} onCenterChange={(center) => setLocationFocus((current) => current ? { ...current, lat: center.lat, lng: center.lng } : { ...center, token: Date.now() })} onError={() => { setCesiumMapFailed(true); setMapEngine('three') }} onStatus={setCesiumStatus} /> : <EarthGlobe baseTextureUrl={`/api/earth-layer?layer=Visible%20Earth&date=${selectedDate}`} textureUrl={`/api/earth-layer?layer=${encodeURIComponent(activeLayer)}&date=${selectedDate}`} overlayEnabled={activeLayer !== 'Visible Earth' && activeLayer !== 'Satellites Now'} satellites={missions} selectedMission={selectedMission} brightView={brightView} resetToken={viewReset} focusLocation={locationFocus} cameraCommand={cameraCommand} onSelectMission={setSelectedMission} onTextureFallback={setLayerFallback} />}
          <div className="scene-caption"><span className="caption-kicker">{satelliteData ? `${satelliteData.count} TRACKED SPACECRAFT` : satelliteError ? 'SATELLITE FEED UNAVAILABLE' : 'LOADING LIVE ORBITS'}</span><span className="caption-coords">{selectedLocation ? `${selectedLocation.lat.toFixed(3)}°, ${selectedLocation.lng.toFixed(3)}°` : selected ? `${Math.abs(selected.latitude).toFixed(1)}° ${selected.latitude >= 0 ? 'N' : 'S'} / ${Math.abs(selected.longitude).toFixed(1)}° ${selected.longitude >= 0 ? 'E' : 'W'}` : 'CelesTrak SGP4 propagation'}</span></div>
          {layerFallback && <div className="layer-fallback-note">{activeLayer} imagery unavailable for this date · showing Visible Earth</div>}
          <div className="map-controls"><button aria-label="Reset view" onClick={() => { setActiveLayer('Satellites Now'); setTime(0); setViewReset((value) => value + 1); issueCameraCommand('reset') }}><Crosshair size={16} /></button><button aria-label="Zoom in" onClick={() => issueCameraCommand('zoom-in')}><ZoomIn size={16} /></button><button aria-label="Zoom out" onClick={() => issueCameraCommand('zoom-out')}><ZoomOut size={16} /></button><button aria-label="Reset compass north" onClick={() => issueCameraCommand('north')}><Compass size={16} /></button><button aria-label="Toggle camera tilt" onClick={() => issueCameraCommand('tilt')}><Mountain size={16} /></button>{selectedLocation && <button aria-label="Save selected location" onClick={saveSelectedLocation}><Bookmark size={15} /></button>}<button aria-label="Toggle fullscreen" onClick={() => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()}><Expand size={15} /></button></div>
          {mapEngine === 'cesium' && !cesiumMapFailed && <div className="map-provider-note">{cesiumStatus || (cesiumIonToken ? 'CESIUMJS · NASA GIBS · CESIUM ION' : 'CESIUMJS · NASA GIBS · ELLIPSOID TERRAIN')}</div>}
          {mapEngine === 'google' && !googleMapsApiKey && <div className="map-provider-note">ADD NEXT_PUBLIC_GOOGLE_MAPS_API_KEY TO ENABLE GOOGLE 3D</div>}
          {googleMapFailed && <div className="map-provider-note">GOOGLE MAPS 3D UNAVAILABLE · CESIUM ACTIVE</div>}
          {cesiumMapFailed && <div className="map-provider-note">CESIUM UNAVAILABLE · NASA GLOBE ACTIVE</div>}
          {showSavedLocations && <div className="saved-locations-panel"><div className="saved-heading"><b>Saved locations</b><button aria-label="Close saved locations" onClick={() => setShowSavedLocations(false)}><X size={14} /></button></div>{savedLocations.length ? savedLocations.map((location) => <button key={location.id} onClick={() => selectLocation(location)}><MapPin size={13} /><span>{location.name}</span></button>) : <p>Locations you save on this device appear here.</p>}</div>}
          {showEvent && <div className="event-banner" id="events"><span className="event-pulse" /><span className="event-copy"><small>{latestEvent ? `NASA EONET · ${latestEvent.categories?.[0]?.title ?? 'OPEN EVENT'}` : eventsError ? 'NASA EONET · FEED UNAVAILABLE' : 'NASA EONET · LOADING'}</small><b>{latestEvent?.title ?? (eventsError ? 'Could not load current events' : 'Loading current events…')}</b></span>{latestEvent?.sources?.[0]?.url && <a href={latestEvent.sources[0].url} target="_blank" rel="noreferrer" aria-label="Open NASA event details"><ChevronRight size={17} /></a>}<button className="event-dismiss-button" aria-label="Dismiss event" onClick={() => setShowEvent(false)}><X className="event-dismiss" size={14} /></button></div>}
          <div className="data-credit">VISUALIZATION&nbsp; · &nbsp;EARTH OBSERVATORY</div>
        </div>

        <aside className={panelOpen ? 'side-panel' : 'side-panel panel-hidden'}>
          <div className="panel-heading"><div><div className="eyebrow">PLANETARY OVERVIEW</div><h1>Explore Earth</h1></div><button className="icon-button" aria-label="Panel settings"><Settings2 size={17} /></button></div>
          <p className="panel-intro">A living planet, seen through the eyes of Earth-observing missions.</p>
          <div className="layer-selector" id="layers">
            <button className="layer-current" onClick={() => setShowLayerMenu(!showLayerMenu)}><span className="layer-icon"><Layers size={16} /></span><span><small>DATA LAYER</small><b>{activeLayer}</b></span><ChevronDown className={showLayerMenu ? 'chevron-rotated' : ''} size={16} /></button>
            {showLayerMenu && <div className="layer-menu">{layers.map((layer) => <button key={layer} className={activeLayer === layer ? 'layer-option selected' : 'layer-option'} onClick={() => { setActiveLayer(layer); setShowLayerMenu(false) }}>{layer}{activeLayer === layer && <span className="selected-check">●</span>}</button>)}</div>}
          </div>
          {showGoogleMap && <div className="map-mode-switch" role="group" aria-label="Satellite map style"><button className={mapMode === 'SATELLITE' ? 'mode-selected' : ''} onClick={() => setMapMode('SATELLITE')}>Satellite</button><button className={mapMode === 'HYBRID' ? 'mode-selected' : ''} onClick={() => setMapMode('HYBRID')}>Labels</button></div>}
          <div className="section-row"><h2>EARTH OBSERVATION SATELLITES</h2><span>{satelliteData ? `${satelliteData.count} TRACKED` : 'LIVE FEED'}</span><button onClick={() => setShowMissions(!showMissions)} aria-label="Toggle satellites"><ChevronDown className={!showMissions ? 'chevron-closed' : ''} size={15} /></button></div>
          {showMissions && <>
            <label className="search-box"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a satellite" aria-label="Find a satellite" />{search && <button onClick={() => setSearch('')} aria-label="Clear search"><X size={13} /></button>}</label>
            <div className="mission-list" id="missions">{missions.filter((mission) => mission.name.toLowerCase().includes(search.toLowerCase())).map((mission) => <button key={mission.noradId} className={selectedMission === mission.noradId || (!selectedMission && mission === missions[0]) ? 'mission-row mission-selected' : 'mission-row'} onClick={() => setSelectedMission(mission.noradId)}><span className="mission-status" style={{ '--marker': mission.color } as React.CSSProperties} /><span className="mission-name">{mission.name}<small>{mission.detail}</small></span><ChevronRight size={15} /></button>)}</div>
            {!missions.length && <div className="empty-state">{satelliteError ? 'CelesTrak data is currently unavailable.' : 'Fetching current orbital elements…'}</div>}
          </>}
          <div className="mission-detail"><div className="detail-heading"><span className="detail-orb" style={{ '--marker': selected?.color ?? '#7dd3fc' } as React.CSSProperties} /><div><small>LIVE ORBITAL TRACK</small><b>{selected?.name ?? 'Waiting for satellite data'}</b></div><span className="orbit-live"><i /> {selected ? 'LIVE' : 'CONNECTING'}</span></div><p>{selected ? `NORAD catalog ID ${selected.noradId} · position propagated from current CelesTrak elements.` : satelliteError ? 'The orbital feed is unavailable. Please retry shortly.' : 'Loading current orbital elements from CelesTrak.'}</p><div className="detail-stats"><div><small>ALTITUDE</small><b>{selected ? `${selected.altitudeKm.toLocaleString()} km` : '—'}</b></div><div><small>INCLINATION</small><b>{selected ? `${selected.inclination.toFixed(1)}°` : '—'}</b></div><div><small>POSITION</small><b>{selected ? `${selected.latitude.toFixed(1)}, ${selected.longitude.toFixed(1)}` : '—'}</b></div></div></div>
          <section className="analysis-panel" id="analysis">
            <div className="section-row"><h2>ENVIRONMENTAL ANALYSIS</h2><span>EARTH ENGINE</span></div>
            <label className="analysis-select-label">ANALYSIS TYPE<select value={analysisKind} onChange={(event) => { setAnalysisKind(event.target.value as AnalysisKind); setAnalysisResult(null); setAnalysisStatus('') }}>{analysisOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
            <div className="analysis-years"><label>BASELINE<select value={baselineYear} onChange={(event) => setBaselineYear(event.target.value)}>{Array.from({ length: 10 }, (_, index) => 2015 + index).map((year) => <option key={year} value={year}>{year}</option>)}</select></label><label>COMPARISON<select value={comparisonYear} onChange={(event) => setComparisonYear(event.target.value)}>{Array.from({ length: 10 }, (_, index) => 2016 + index).map((year) => <option key={year} value={year}>{year}</option>)}</select></label></div>
            <label className="radius-field">AREA RADIUS <span><input type="number" min="1" max="100" value={areaRadiusKm} onChange={(event) => setAreaRadiusKm(event.target.value)} /> km</span></label>
            <p className="analysis-region">{selectedLocation ? `Area centered on ${selectedLocation.name}` : 'Search and select a location to define the analysis area.'}</p>
            <button className="run-analysis-button" onClick={runAnalysis} disabled={analysisBusy}>{analysisBusy ? 'Submitting…' : 'Run analysis'}<ArrowRight size={14} /></button>
            {analysisStatus && <p className="analysis-status" role="status">{analysisStatus}</p>}
            {analysisResult?.dataset && <p className="analysis-dataset">Dataset: {analysisResult.dataset}</p>}
            {analysisResult?.measurements && <div className="analysis-measurements"><b>Measured results</b>{Object.entries(analysisResult.measurements).map(([name, value]) => <div key={name}><span>{name}</span><strong>{value}</strong></div>)}</div>}
            <div className="analysis-insights"><b>AI insights</b>{analysisResult?.insights?.length ? analysisResult.insights.map((insight) => <p key={insight}>{insight}</p>) : <p>Insights appear only when returned by the configured analysis service.</p>}</div>
            {analysisHistory.length > 0 && <div className="analysis-history"><b>Recent jobs</b>{analysisHistory.map((entry) => <p key={entry.jobId}>{entry.analysis} · {entry.status}<small>{new Date(entry.createdAt).toLocaleDateString()}</small></p>)}</div>}
          </section>
          <a className="vital-link" href="https://climate.nasa.gov/vital-signs/" target="_blank" rel="noreferrer"><Activity size={16} /><span><b>Vital signs of the planet</b><small>Climate indicators &amp; global trends</small></span><ArrowRight size={16} /></a>
        </aside>
      </section>

      <footer className="timebar"><div className="time-label"><span className="time-dot" /><span><small>IMAGERY DATE</small><b>{formatDate(time)} UTC</b></span></div><div className="timeline"><button className="timeline-edge" aria-label="Step to previous day" onClick={() => setTime(Math.max(-30, time - 1))}><ArrowLeft size={15} /></button><input className="timeline-range" aria-label="Choose imagery date from the past 30 days" type="range" min={-30} max={0} value={time} onChange={(event) => setTime(Number(event.target.value))} /><button className="timeline-edge" aria-label="Step to next day" onClick={() => setTime(Math.min(0, time + 1))}><ArrowRight size={15} /></button></div><div className="time-actions"><button className="reset-button" onClick={() => { setPlaying(false); setTime(0) }}><RotateCcw size={14} /><span>NOW</span></button><button className="play-button" onClick={() => setPlaying(!playing)} aria-label={playing ? 'Pause timeline' : 'Play timeline'}>{playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}</button></div><div className="bottom-credit">NASA GIBS <span>·</span> CELESTRAK <span>·</span> NASA EONET</div></footer>
    </main>
  )
}
