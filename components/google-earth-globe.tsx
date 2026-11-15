'use client'

import { useEffect, useRef, useState } from 'react'

export type GoogleCameraCommand = {
  id: number
  action: 'reset' | 'zoom-in' | 'zoom-out' | 'north' | 'tilt'
}

export type GlobeLocation = {
  lat: number
  lng: number
  token: number
  name?: string
  displayName?: string
}

type TrackedSatellite = {
  noradId: number
  name: string
  latitude: number
  longitude: number
  altitudeKm: number
}

type MapCenter = { lat: number; lng: number; altitude?: number }
type MapCameraOptions = { center: MapCenter; range: number; tilt: number; heading: number }
type Google3DMap = HTMLElement & {
  center: MapCenter | null
  range: number
  tilt: number
  heading: number
  mode: 'SATELLITE' | 'HYBRID' | 'ROADMAP'
  flyCameraTo: (options: { endCamera: MapCameraOptions; durationMillis: number }) => Promise<void>
}

type Maps3DLibrary = {
  Map3DElement: new (options: {
    center: MapCenter
    range: number
    tilt: number
    heading: number
    mode: 'SATELLITE' | 'HYBRID'
    defaultUIHidden: boolean
    gestureHandling: 'GREEDY'
    qualityMode: 'PERFORMANCE'
    maxMemoryMegabytes: number
  }) => Google3DMap
  Marker3DInteractiveElement: new (options: {
    position: MapCenter
    altitudeMode: 'ABSOLUTE'
    label: string
    title: string
    sizePreserved: boolean
    drawsWhenOccluded: boolean
  }) => HTMLElement
}

type GoogleWindow = Window & {
  google?: { maps?: { importLibrary?: (name: string) => Promise<unknown> } }
}

type GoogleEarthGlobeProps = {
  apiKey: string
  satellites: TrackedSatellite[]
  selectedMission: number | null
  location: GlobeLocation | null
  cameraCommand: GoogleCameraCommand
  mode: 'SATELLITE' | 'HYBRID'
  onSelectMission: (noradId: number) => void
  onCenterChange: (center: { lat: number; lng: number }) => void
  onError: () => void
}

let mapsScriptPromise: Promise<void> | null = null

function loadMapsScript(apiKey: string): Promise<void> {
  const google = (window as GoogleWindow).google
  if (google?.maps?.importLibrary) return Promise.resolve()
  if (mapsScriptPromise) return mapsScriptPromise

  mapsScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.dataset.earthTrendsMaps3d = 'true'
    script.async = true
    script.src = `https://maps.googleapis.com/maps/api/js?loading=async&key=${encodeURIComponent(apiKey)}&v=beta&libraries=maps3d`
    script.onload = () => resolve()
    script.onerror = () => {
      mapsScriptPromise = null
      script.remove()
      reject(new Error('Google Maps JavaScript API could not be loaded.'))
    }
    document.head.appendChild(script)
  })
  return mapsScriptPromise
}

function readCoordinate(value: number | (() => number) | undefined): number | null {
  const coordinate = typeof value === 'function' ? value() : value
  return typeof coordinate === 'number' && Number.isFinite(coordinate) ? coordinate : null
}

export default function GoogleEarthGlobe({ apiKey, satellites, selectedMission, location, cameraCommand, mode, onSelectMission, onCenterChange, onError }: GoogleEarthGlobeProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [mapReady, setMapReady] = useState(false)
  const mapRef = useRef<Google3DMap | null>(null)
  const markersRef = useRef<HTMLElement[]>([])
  const onSelectMissionRef = useRef(onSelectMission)
  const onCenterChangeRef = useRef(onCenterChange)
  const onErrorRef = useRef(onError)
  const locationRef = useRef(location)
  const commandRef = useRef(cameraCommand)
  const satelliteKey = satellites.map(({ noradId, latitude, longitude, altitudeKm }) => `${noradId}:${latitude}:${longitude}:${altitudeKm}`).join('|')

  onSelectMissionRef.current = onSelectMission
  onCenterChangeRef.current = onCenterChange
  onErrorRef.current = onError
  locationRef.current = location
  commandRef.current = cameraCommand

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let disposed = false
    let map: Google3DMap | null = null
    const onMapError = () => onErrorRef.current()

    const updateCenter = () => {
      if (!map?.center) return
      const lat = readCoordinate(map.center.lat)
      const lng = readCoordinate(map.center.lng)
      if (lat !== null && lng !== null) onCenterChangeRef.current({ lat, lng })
    }

    const initialize = async () => {
      await loadMapsScript(apiKey)
      const importLibrary = (window as GoogleWindow).google?.maps?.importLibrary
      if (!importLibrary) throw new Error('Google Maps 3D is unavailable.')
      const { Map3DElement } = await importLibrary('maps3d') as Maps3DLibrary
      if (disposed) return

      map = new Map3DElement({
        center: { lat: 0, lng: 0, altitude: 0 },
        range: 20_000_000,
        tilt: 0,
        heading: 0,
        mode,
        defaultUIHidden: true,
        gestureHandling: 'GREEDY',
        qualityMode: 'PERFORMANCE',
        maxMemoryMegabytes: 512,
      })
      map.style.width = '100%'
      map.style.height = '100%'
      map.setAttribute('description', 'Interactive 3D Earth with satellite imagery. Drag to rotate and scroll to zoom.')
      map.addEventListener('gmp-centerchange', updateCenter)
      map.addEventListener('gmp-error', onMapError)
      host.replaceChildren(map)
      mapRef.current = map
      setMapReady(true)
      updateCenter()
    }

    initialize().catch(() => {
      if (!disposed) onErrorRef.current()
    })

    return () => {
      disposed = true
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = []
      map?.removeEventListener('gmp-centerchange', updateCenter)
      map?.removeEventListener('gmp-error', onMapError)
      map?.remove()
      mapRef.current = null
      setMapReady(false)
    }
  }, [apiKey])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.mode = mode
  }, [mode, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !location) return
    map.flyCameraTo({
      endCamera: { center: { lat: location.lat, lng: location.lng, altitude: 0 }, range: 2_500_000, tilt: 62, heading: 0 },
      durationMillis: 2800,
    })
  }, [location?.token, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || cameraCommand.id === 0) return
    if (cameraCommand.action === 'reset') {
      map.flyCameraTo({ endCamera: { center: { lat: 0, lng: 0, altitude: 0 }, range: 20_000_000, tilt: 0, heading: 0 }, durationMillis: 1800 })
    } else if (cameraCommand.action === 'zoom-in') {
      map.range = Math.max(700, map.range * 0.65)
    } else if (cameraCommand.action === 'zoom-out') {
      map.range = Math.min(20_000_000, map.range * 1.45)
    } else if (cameraCommand.action === 'north') {
      map.heading = 0
    } else {
      map.tilt = map.tilt > 30 ? 0 : 55
    }
  }, [cameraCommand.id, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    let disposed = false
    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = []

    const renderMarkers = async () => {
      const importLibrary = (window as GoogleWindow).google?.maps?.importLibrary
      if (!importLibrary) return
      const { Marker3DInteractiveElement } = await importLibrary('maps3d') as Maps3DLibrary
      if (disposed || mapRef.current !== map) return

      for (const satellite of satellites.slice(0, 60)) {
        const marker = new Marker3DInteractiveElement({
          position: { lat: satellite.latitude, lng: satellite.longitude, altitude: satellite.altitudeKm * 1000 },
          altitudeMode: 'ABSOLUTE',
          label: satellite.name,
          title: `${satellite.name} · NORAD ${satellite.noradId}`,
          sizePreserved: true,
          drawsWhenOccluded: false,
        })
        marker.addEventListener('gmp-click', () => onSelectMissionRef.current(satellite.noradId))
        map.append(marker)
        markersRef.current.push(marker)
      }
    }

    renderMarkers().catch(() => onErrorRef.current())
    return () => { disposed = true }
  }, [satelliteKey, selectedMission, mapReady])

  return <div ref={hostRef} className="google-earth-canvas" aria-label="Google Maps interactive 3D Earth" />
}