'use client'

import { useEffect, useRef, useState } from 'react'
import type { Entity, ImageryLayer, TerrainProvider, Viewer } from 'cesium'
import type { GlobeLocation, GoogleCameraCommand } from '@/components/google-earth-globe'

type TrackedSatellite = {
  noradId: number
  name: string
  latitude: number
  longitude: number
  altitudeKm: number
  color: string
}

type CesiumEarthGlobeProps = {
  baseTextureUrl: string
  textureUrl: string
  imageryDate: string
  overlayEnabled: boolean
  ionAccessToken: string
  satellites: TrackedSatellite[]
  selectedMission: number | null
  location: GlobeLocation | null
  cameraCommand: GoogleCameraCommand
  onSelectMission: (noradId: number) => void
  onCenterChange: (center: { lat: number; lng: number }) => void
  onError: () => void
  onStatus: (status: string) => void
}

type CesiumWindow = Window & { CESIUM_BASE_URL?: string }

export default function CesiumEarthGlobe({ baseTextureUrl, textureUrl, imageryDate, overlayEnabled, ionAccessToken, satellites, selectedMission, location, cameraCommand, onSelectMission, onCenterChange, onError, onStatus }: CesiumEarthGlobeProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Viewer | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const onSelectMissionRef = useRef(onSelectMission)
  const onCenterChangeRef = useRef(onCenterChange)
  const onErrorRef = useRef(onError)
  const onStatusRef = useRef(onStatus)
  const locationRef = useRef(location)
  const cameraCommandRef = useRef(cameraCommand)
  const satellitesRef = useRef(satellites)
  const selectedMissionRef = useRef(selectedMission)
  const satelliteKey = satellites.map(({ noradId, latitude, longitude, altitudeKm }) => `${noradId}:${latitude}:${longitude}:${altitudeKm}`).join('|')

  onSelectMissionRef.current = onSelectMission
  onCenterChangeRef.current = onCenterChange
  onErrorRef.current = onError
  onStatusRef.current = onStatus
  locationRef.current = location
  cameraCommandRef.current = cameraCommand
  satellitesRef.current = satellites
  selectedMissionRef.current = selectedMission

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let disposed = false
    let viewer: Viewer | null = null
    let cameraChanged: (() => void) | null = null
    const cssLink = document.createElement('link')
    cssLink.rel = 'stylesheet'
    cssLink.href = '/api/cesium/Widgets/widgets.css'
    cssLink.dataset.cesiumWidgets = 'true'
    document.head.append(cssLink)

    const initialize = async () => {
      const cesiumWindow = window as CesiumWindow
      cesiumWindow.CESIUM_BASE_URL = '/api/cesium/'
      const Cesium = await import('cesium')
      if (disposed) return

      let terrainProvider: TerrainProvider = new Cesium.EllipsoidTerrainProvider()
      let hasIonTerrain = false
      if (ionAccessToken) {
        Cesium.Ion.defaultAccessToken = ionAccessToken
        try {
          terrainProvider = await Cesium.CesiumTerrainProvider.fromIonAssetId(1)
          hasIonTerrain = true
        } catch {
          onStatusRef.current('Cesium ion terrain could not load; using the reference ellipsoid.')
        }
      } else {
        onStatusRef.current('NASA GIBS imagery active · add a Cesium ion token for global terrain.')
      }
      if (disposed) return

      viewer = new Cesium.Viewer(host, {
        animation: false,
        baseLayer: false,
        baseLayerPicker: false,
        fullscreenButton: false,
        geocoder: false,
        homeButton: false,
        infoBox: false,
        navigationHelpButton: false,
        sceneModePicker: false,
        selectionIndicator: false,
        timeline: false,
        terrainProvider,
        useBrowserRecommendedResolution: true,
        requestRenderMode: true,
        maximumRenderTimeChange: Infinity,
        scene3DOnly: true,
        targetFrameRate: 60,
      })
      viewerRef.current = viewer
      setMapReady(true)
      viewer.resolutionScale = Math.min(window.devicePixelRatio || 1, 1.5)
      viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#03060a')
      viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#07121d')
      viewer.scene.globe.enableLighting = true
      viewer.scene.screenSpaceCameraController.minimumZoomDistance = 650
      viewer.scene.screenSpaceCameraController.maximumZoomDistance = 28_000_000
      viewer.scene.screenSpaceCameraController.enableCollisionDetection = true
      viewer.camera.setView({
        destination: Cesium.Rectangle.fromDegrees(-180, -90, 180, 90),
      })

      viewer.imageryLayers.removeAll()
      if (ionAccessToken) {
        try {
          const aerial = await Cesium.createWorldImageryAsync({ style: Cesium.IonWorldImageryStyle.AERIAL })
          if (disposed || !viewer) return
          viewer.imageryLayers.addImageryProvider(aerial)
          onStatusRef.current(hasIonTerrain ? 'Cesium ion aerial imagery and terrain active.' : 'Cesium ion aerial imagery active · terrain unavailable.')
        } catch {
          onStatusRef.current('Cesium ion imagery could not load; using NASA GIBS imagery.')
        }
      }

      cameraChanged = () => {
        if (!viewer) return
        const center = viewer.camera.pickEllipsoid(
          new Cesium.Cartesian2(viewer.canvas.clientWidth / 2, viewer.canvas.clientHeight / 2),
          viewer.scene.globe.ellipsoid,
        )
        if (!center) return
        const cartographic = Cesium.Cartographic.fromCartesian(center)
        onCenterChangeRef.current({ lat: Cesium.Math.toDegrees(cartographic.latitude), lng: Cesium.Math.toDegrees(cartographic.longitude) })
      }
      viewer.camera.changed.addEventListener(cameraChanged)
      viewer.screenSpaceEventHandler.setInputAction((movement: { position: InstanceType<typeof Cesium.Cartesian2> }) => {
        const picked = viewer?.scene.pick(movement.position) as { id?: Entity } | undefined
        const id = picked?.id?.id
        if (typeof id === 'string' && id.startsWith('satellite-')) onSelectMissionRef.current(Number(id.slice('satellite-'.length)))
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
      cameraChanged()
    }

    initialize().catch(() => {
      if (!disposed) onErrorRef.current()
    })

    return () => {
      disposed = true
      if (viewer && cameraChanged) viewer.camera.changed.removeEventListener(cameraChanged)
      if (viewer && !viewer.isDestroyed()) viewer.destroy()
      viewerRef.current = null
      setMapReady(false)
      cssLink.remove()
    }
  }, [ionAccessToken])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || !mapReady) return
    let cancelled = false
    let baseLayer: ImageryLayer | undefined
    const setBaseImagery = async () => {
      const Cesium = await import('cesium')
      const provider = await Cesium.SingleTileImageryProvider.fromUrl(baseTextureUrl, { credit: 'NASA GIBS · Blue Marble' })
      if (cancelled || viewer.isDestroyed()) return
      baseLayer = viewer.imageryLayers.addImageryProvider(provider, 0)
    }
    setBaseImagery().catch(() => onStatusRef.current('NASA Blue Marble base imagery could not load.'))
    return () => {
      cancelled = true
      if (baseLayer && !viewer.isDestroyed()) viewer.imageryLayers.remove(baseLayer, true)
    }
  }, [baseTextureUrl, mapReady])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || !mapReady || !location) return
    let locationEntity: Entity | undefined
    import('cesium').then((Cesium) => {
      if (viewer.isDestroyed()) return
      const existing = viewer.entities.getById('selected-location-marker')
      if (existing) viewer.entities.remove(existing)

      const labelText = location.displayName || location.name || `${location.lat.toFixed(2)}°, ${location.lng.toFixed(2)}°`
      locationEntity = viewer.entities.add({
        id: 'selected-location-marker',
        name: labelText,
        position: new Cesium.ConstantPositionProperty(Cesium.Cartesian3.fromDegrees(location.lng, location.lat, 0)),
        point: new Cesium.PointGraphics({
          pixelSize: 10,
          color: Cesium.Color.fromCssColorString('#f6c85f'),
          outlineColor: Cesium.Color.fromCssColorString('#07101b'),
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        }),
        label: new Cesium.LabelGraphics({
          text: labelText,
          font: 'bold 12px sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.fromCssColorString('#07101b'),
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString('rgba(11, 22, 34, 0.85)'),
          backgroundPadding: new Cesium.Cartesian2(7, 4),
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          pixelOffset: new Cesium.Cartesian2(0, -12),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        }),
      })

      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(location.lng, location.lat, 2_000_000),
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-48), roll: 0 },
        duration: 0.8,
      })
      viewer.scene.requestRender()
    }).catch(() => onErrorRef.current())

    return () => {
      if (viewer && !viewer.isDestroyed() && locationEntity) {
        viewer.entities.remove(locationEntity)
      }
    }
  }, [location?.token, mapReady])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || !mapReady || cameraCommand.id === 0) return
    import('cesium').then((Cesium) => {
      if (viewer.isDestroyed()) return
      if (cameraCommand.action === 'reset') {
        viewer.camera.flyTo({
          destination: Cesium.Rectangle.fromDegrees(-180, -90, 180, 90),
          duration: 1.6,
        })
      } else if (cameraCommand.action === 'zoom-in') viewer.camera.zoomIn(750_000)
      else if (cameraCommand.action === 'zoom-out') viewer.camera.zoomOut(750_000)
      else if (cameraCommand.action === 'north') {
        viewer.camera.setView({ orientation: { heading: 0, pitch: viewer.camera.pitch, roll: viewer.camera.roll } })
      } else {
        viewer.camera.setView({ orientation: { heading: viewer.camera.heading, pitch: viewer.camera.pitch < -1 ? -0.75 : Cesium.Math.toRadians(-90), roll: viewer.camera.roll } })
      }
    }).catch(() => onErrorRef.current())
  }, [cameraCommand.id, mapReady])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || !mapReady) return
    const entities = satellitesRef.current.slice(0, 60).map((satellite) => {
      const selected = satellite.noradId === selectedMissionRef.current
      return viewer.entities.add({
        id: `satellite-${satellite.noradId}`,
        name: satellite.name,
        position: undefined,
        point: undefined,
        properties: { noradId: satellite.noradId },
      })
    })
    import('cesium').then((Cesium) => {
      if (viewer.isDestroyed()) return
      for (let index = 0; index < entities.length; index += 1) {
        const satellite = satellitesRef.current[index]
        const entity = entities[index]
        const selected = satellite.noradId === selectedMissionRef.current
        entity.position = new Cesium.ConstantPositionProperty(Cesium.Cartesian3.fromDegrees(satellite.longitude, satellite.latitude, satellite.altitudeKm * 1000))
        entity.point = new Cesium.PointGraphics({
          color: Cesium.Color.fromCssColorString(selected ? '#ffffff' : satellite.color),
          outlineColor: Cesium.Color.fromCssColorString(satellite.color),
          outlineWidth: selected ? 2 : 1,
          pixelSize: selected ? 11 : 7,
          scaleByDistance: new Cesium.NearFarScalar(1_000_000, 1.4, 20_000_000, 0.7),
        })
        if (selected) entity.label = new Cesium.LabelGraphics({
          text: satellite.name,
          font: '12px sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -16),
          scaleByDistance: new Cesium.NearFarScalar(2_000_000, 1, 18_000_000, 0.4),
        })
      }
    }).catch(() => onErrorRef.current())
    return () => {
      if (viewer.isDestroyed()) return
      entities.forEach((entity) => viewer.entities.remove(entity))
    }
  }, [satelliteKey, selectedMission, mapReady])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || !mapReady || !overlayEnabled) return
    const controller = new AbortController()
    let overlayLayer: ImageryLayer | undefined
    let objectUrl: string | undefined

    const addOverlay = async () => {
      const response = await fetch(textureUrl, { signal: controller.signal })
      if (!response.ok) throw new Error('NASA imagery is unavailable for this date.')
      const bitmap = await createImageBitmap(await response.blob())
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) throw new Error('Canvas image processing is unavailable.')
      context.drawImage(bitmap, 0, 0)
      bitmap.close()
      const image = context.getImageData(0, 0, canvas.width, canvas.height)
      for (let index = 0; index < image.data.length; index += 4) {
        if (Math.max(image.data[index], image.data[index + 1], image.data[index + 2]) < 18) image.data[index + 3] = 0
      }
      context.putImageData(image, 0, 0)
      const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('NASA overlay could not be prepared.')), 'image/png'))
      objectUrl = URL.createObjectURL(png)
      const Cesium = await import('cesium')
      const provider = await Cesium.SingleTileImageryProvider.fromUrl(objectUrl, { credit: `NASA GIBS · ${imageryDate}` })
      if (controller.signal.aborted || viewer.isDestroyed()) return
      overlayLayer = viewer.imageryLayers.addImageryProvider(provider)
      overlayLayer.alpha = 0.78
    }

    addOverlay().catch(() => {
      if (!controller.signal.aborted) onStatusRef.current(`NASA ${imageryDate} overlay unavailable · base imagery remains visible.`)
    })
    return () => {
      controller.abort()
      if (overlayLayer && !viewer.isDestroyed()) viewer.imageryLayers.remove(overlayLayer, true)
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [imageryDate, mapReady, overlayEnabled, textureUrl])

  return <div ref={hostRef} className="cesium-earth-canvas" aria-label="Cesium interactive 3D Earth. Drag to rotate and scroll to zoom." />
}