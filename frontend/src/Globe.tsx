import { useEffect, useRef } from "react";
import {
  Cartesian2,
  Cartesian3,
  Color,
  ColorMaterialProperty,
  ConstantPositionProperty,
  ConstantProperty,
  Entity,
  GeoJsonDataSource,
  HeightReference,
  HorizontalOrigin,
  Ion,
  IonImageryProvider,
  JulianDate,
  LabelGraphics,
  LabelStyle,
  NearFarScalar,
  PointGraphics,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  UrlTemplateImageryProvider,
  VerticalOrigin,
  Viewer,
  SkyBox,
  SkyAtmosphere,
  defined,
} from "cesium";

interface GlobeProps {
  selectedRegionId: string;
  onSelectRegion: (regionId: string) => void;
  showBoundaries: boolean;
  showWorldBoundaries: boolean;
  showIndiaStates: boolean;
  preset: "india" | "maharashtra" | "vidarbha";
  onImageryStatus: (status: "loading" | "ready" | "error") => void;
  /** A highlighted point (any place on Earth). The camera flies to it when it is not inside Vidarbha. */
  marker?: { lat: number; lon: number; label: string };
}

const presets = {
  india: { longitude: 78.9629, latitude: 20.5937, height: 5_500_000 },
  maharashtra: { longitude: 75.7, latitude: 19.7, height: 1_800_000 },
  vidarbha: { longitude: 78.25, latitude: 20.5, height: 950_000 },
};

type Coordinates = [number, number];

function computePolygonCenter(geometry: {
  type: string;
  coordinates: any;
}): { lng: number; lat: number } | null {
  if (!geometry || !geometry.coordinates) return null;
  if (geometry.type === "Point") {
    return { lng: geometry.coordinates[0], lat: geometry.coordinates[1] };
  }

  let rings: Coordinates[][] = [];
  if (geometry.type === "Polygon") {
    rings = [geometry.coordinates[0] as Coordinates[]];
  } else if (geometry.type === "MultiPolygon") {
    rings = (geometry.coordinates as Coordinates[][][]).map((poly) => poly[0]);
  }

  let totalArea = 0;
  let cx = 0;
  let cy = 0;
  let totalPts = 0;
  let meanX = 0;
  let meanY = 0;

  for (const ring of rings) {
    if (!ring || ring.length < 3) continue;
    let ringArea = 0;
    let ringCx = 0;
    let ringCy = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const x0 = ring[i][0];
      const y0 = ring[i][1];
      const x1 = ring[i + 1][0];
      const y1 = ring[i + 1][1];
      const a = x0 * y1 - x1 * y0;
      ringArea += a;
      ringCx += (x0 + x1) * a;
      ringCy += (y0 + y1) * a;
      meanX += x0;
      meanY += y0;
      totalPts++;
    }
    ringArea *= 0.5;
    if (Math.abs(ringArea) > 1e-7) {
      ringCx /= 6 * ringArea;
      ringCy /= 6 * ringArea;
      const absArea = Math.abs(ringArea);
      cx += ringCx * absArea;
      cy += ringCy * absArea;
      totalArea += absArea;
    }
  }

  if (totalArea > 0) {
    return { lng: cx / totalArea, lat: cy / totalArea };
  }
  if (totalPts > 0) {
    return { lng: meanX / totalPts, lat: meanY / totalPts };
  }
  return null;
}

function styleBoundaries(
  dataSource: GeoJsonDataSource,
  selectedRegionId: string,
) {
  for (const entity of dataSource.entities.values) {
    const properties = entity.properties?.getValue(JulianDate.now());
    const regionId =
      typeof properties?.region_id === "string" ? properties.region_id : "";
    const isRegion = properties?.level === "region";
    const selected = regionId === selectedRegionId;
    const name = typeof properties?.name === "string" ? properties.name : regionId;

    if (entity.polygon) {
      entity.polygon.material = new ColorMaterialProperty(
        new Color(
          selected ? 1.0 : isRegion ? 0.0 : 0.0,
          selected ? 0.93 : isRegion ? 0.9 : 1.0,
          selected ? 0.0 : isRegion ? 1.0 : 0.53,
          selected ? 0.22 : isRegion ? 0.06 : 0.1,
        ),
      );
      entity.polygon.outline = new ConstantProperty(true);
      entity.polygon.outlineColor = new ConstantProperty(
        selected
          ? Color.fromCssColorString("#ffe944")
          : Color.fromCssColorString(isRegion ? "#00e5ff" : "#00ff9f"),
      );
      entity.polygon.outlineWidth = new ConstantProperty(selected ? 3.5 : isRegion ? 2.0 : 1.5);
      entity.polygon.height = new ConstantProperty(0);
    }

    if (entity.point) {
      entity.point.color = new ConstantProperty(
        selected
          ? Color.fromCssColorString("#ffe944")
          : Color.fromCssColorString("#00ccff"),
      );
      entity.point.pixelSize = new ConstantProperty(selected ? 13 : isRegion ? 10 : 7);
      entity.point.outlineWidth = new ConstantProperty(selected ? 3 : 2);
      entity.point.outlineColor = new ConstantProperty(
        Color.fromCssColorString(selected ? "#000000" : "#07101b"),
      );
    }

    if (entity.label) {
      entity.label.text = new ConstantProperty(
        selected && isRegion ? `${name} (All 11 Districts)` : name,
      );
      entity.label.fillColor = new ConstantProperty(
        selected
          ? Color.fromCssColorString("#ffe944")
          : isRegion
          ? Color.WHITE
          : Color.fromCssColorString("#e0f7fa"),
      );
      entity.label.backgroundColor = new ConstantProperty(
        selected
          ? Color.fromCssColorString("rgba(10, 20, 10, 0.92)")
          : Color.fromCssColorString("rgba(5, 12, 22, 0.85)"),
      );
      entity.label.font = new ConstantProperty(
        selected
          ? 'bold 13px "Segoe UI", system-ui, -apple-system, sans-serif'
          : isRegion
          ? 'bold 14px "Segoe UI", system-ui, -apple-system, sans-serif'
          : 'bold 11px "Segoe UI", system-ui, -apple-system, sans-serif',
      );
      entity.label.outlineWidth = new ConstantProperty(selected ? 5 : 3);
      entity.label.outlineColor = new ConstantProperty(
        Color.fromCssColorString(selected ? "#000000" : "#05121a"),
      );
    }
  }
}

export default function Globe({
  selectedRegionId,
  onSelectRegion,
  showBoundaries,
  showWorldBoundaries,
  showIndiaStates,
  preset,
  onImageryStatus,
  marker,
}: GlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const boundaryRef = useRef<GeoJsonDataSource | null>(null);
  const worldRef = useRef<GeoJsonDataSource | null>(null);
  const indiaRef = useRef<GeoJsonDataSource | null>(null);
  const centersRef = useRef<Map<string, { lng: number; lat: number }>>(new Map());

  useEffect(() => {
    if (!containerRef.current) return;
    onImageryStatus("loading");

    const viewer = new Viewer(containerRef.current, {
      animation: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      navigationHelpButton: false,
      sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
      vrButton: false,
      fullscreenButton: false,
      baseLayer: false,
      shouldAnimate: false,
      requestRenderMode: true,
      maximumRenderTimeChange: Infinity,
      scene3DOnly: true,
      targetFrameRate: 60,
      contextOptions: {
        webgl: {
          powerPreference: "high-performance",
          failIfMajorPerformanceCaveat: false,
          antialias: true,
        },
      },
    });

    viewerRef.current = viewer;

    // High-DPI crisp display
    viewer.resolutionScale = Math.min(window.devicePixelRatio || 1, 2.0);

    // Deep space background
    viewer.scene.backgroundColor = Color.fromCssColorString("#000008");
    viewer.scene.globe.baseColor = Color.fromCssColorString("#020816");

    // Realistic atmosphere
    viewer.scene.globe.showGroundAtmosphere = true;
    viewer.scene.globe.enableLighting = false; // Always illuminated for crisp high-def satellite viewing 24/7
    viewer.scene.globe.atmosphereHueShift = 0.0;
    viewer.scene.globe.atmosphereSaturationShift = 0.15;
    viewer.scene.globe.atmosphereBrightnessShift = 0.1;

    // Sky & fog
    if (defined(viewer.scene.skyAtmosphere)) {
      (viewer.scene.skyAtmosphere as SkyAtmosphere).show = true;
    }
    viewer.scene.fog.enabled = true;
    viewer.scene.fog.density = 0.00015;

    // HDR off — prevents washed-out look
    if ("highDynamicRange" in viewer.scene) {
      (viewer.scene as any).highDynamicRange = false;
    }

    // Set initial camera
    const initialPreset = presets[preset];
    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(
        initialPreset.longitude,
        initialPreset.latitude,
        initialPreset.height,
      ),
      orientation: {
        heading: 0,
        pitch: -Math.PI / 2,
        roll: 0,
      },
    });

    let active = true;

    // ── REAL SATELLITE IMAGERY LOADER ─────────────────────────────────────────
    const loadImagery = async () => {
      const token = import.meta.env.VITE_CESIUM_ION_ACCESS_TOKEN;

      if (token) {
        // Cesium Ion: Bing Maps Aerial (asset 3) — real satellite photos
        Ion.defaultAccessToken = token;
        try {
          const imagery = await IonImageryProvider.fromAssetId(3); // Bing Maps Aerial
          if (active) {
            viewer.imageryLayers.addImageryProvider(imagery);
            viewer.scene.requestRender();
          }
        } catch {
          // Fall back to ESRI if Bing fails
          await loadESRIFallback();
        }
      } else {
        await loadESRIFallback();
      }

      if (active) onImageryStatus("ready");
    };

    const loadESRIFallback = async () => {
      // ESRI World Imagery — FREE real-world satellite photos (no token needed)
      // This is what Google Earth-like imagery looks like
      const esriImagery = new UrlTemplateImageryProvider({
        url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        credit: "Esri, Maxar, Earthstar Geographics, and the GIS User Community",
        maximumLevel: 19,
        tileWidth: 256,
        tileHeight: 256,
      });
      if (active) {
        viewer.imageryLayers.addImageryProvider(esriImagery);
      }

      // Add ESRI World Boundaries & Labels overlay — roads/country names on top
      const esriLabels = new UrlTemplateImageryProvider({
        url: "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        credit: "Esri",
        maximumLevel: 19,
        tileWidth: 256,
        tileHeight: 256,
      });
      if (active) {
        const labelLayer = viewer.imageryLayers.addImageryProvider(esriLabels);
        labelLayer.alpha = 0.6;
      }

      // NASA GIBS True Color MODIS overlay — adds NASA satellite data layer
      try {
        const gibsLayer = new UrlTemplateImageryProvider({
          url: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/2024-07-15/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg",
          credit: "NASA GIBS / Terra MODIS",
          maximumLevel: 9,
          tileWidth: 256,
          tileHeight: 256,
        });
        if (active) {
          const nasaLayer = viewer.imageryLayers.addImageryProvider(gibsLayer);
          nasaLayer.alpha = 0.0; // invisible by default, available for future toggle
        }
      } catch {
        // GIBS optional, don't fail if unavailable
      }

      if (active) viewer.scene.requestRender();
    };

    const imageryPromise = loadImagery().catch(() => {
      if (active) onImageryStatus("error");
    });

    // ── EVENT HANDLERS ────────────────────────────────────────────────────────
    const clickHandler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    clickHandler.setInputAction(
      (event: ScreenSpaceEventHandler.PositionedEvent) => {
        const picked = viewer.scene.pick(event.position);
        if (picked?.id instanceof Entity) {
          const properties = picked.id.properties?.getValue(JulianDate.now());
          if (typeof properties?.region_id === "string") {
            onSelectRegion(properties.region_id);
          }
        }
      },
      ScreenSpaceEventType.LEFT_CLICK,
    );

    const hoverHandler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    hoverHandler.setInputAction(
      (movement: ScreenSpaceEventHandler.MotionEvent) => {
        const picked = viewer.scene.pick(movement.endPosition);
        if (picked?.id instanceof Entity) {
          viewer.canvas.style.cursor = "pointer";
        } else {
          viewer.canvas.style.cursor = "default";
        }
      },
      ScreenSpaceEventType.MOUSE_MOVE,
    );

    // ── WORLD COUNTRY OUTLINES ────────────────────────────────────────────────
    const WORLD_COUNTRIES_URL =
      "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson";
    GeoJsonDataSource.load(WORLD_COUNTRIES_URL, {
      clampToGround: false,
      stroke: Color.fromCssColorString("#1a3a52"),
      strokeWidth: 1,
      fill: Color.TRANSPARENT,
    })
      .then((ds) => {
        if (!active) return;
        ds.name = "world-countries";
        ds.show = showWorldBoundaries;
        for (const entity of ds.entities.values) {
          if (entity.polygon) {
            entity.polygon.fill = new ConstantProperty(false);
          }
        }
        worldRef.current = ds;
        void viewer.dataSources.add(ds);
        viewer.scene.requestRender();
      })
      .catch(() => { /* offline fallback */ });

    // ── INDIA STATE OUTLINES ──────────────────────────────────────────────────
    const INDIA_STATES_URL =
      "https://raw.githubusercontent.com/geohacker/india/master/state/india_state.geojson";
    GeoJsonDataSource.load(INDIA_STATES_URL, {
      clampToGround: false,
      stroke: Color.fromCssColorString("#1a4a3a"),
      strokeWidth: 1.5,
      fill: Color.TRANSPARENT,
    })
      .then((ds) => {
        if (!active) return;
        ds.name = "india-states";
        ds.show = showIndiaStates;
        for (const entity of ds.entities.values) {
          if (entity.polygon) {
            entity.polygon.fill = new ConstantProperty(false);
          }
        }
        indiaRef.current = ds;
        void viewer.dataSources.add(ds);
        viewer.scene.requestRender();
      })
      .catch(() => { /* offline fallback */ });

    // ── VIDARBHA DISTRICT BOUNDARIES ─────────────────────────────────────────
    fetch(`${import.meta.env.BASE_URL}boundaries/IN-MH-VID.display.geojson`)
      .then((response) => {
        if (!response.ok) throw new Error("Boundary file could not be loaded.");
        return response.json();
      })
      .then((geojson) => {
        const centersMap = new Map<string, { lng: number; lat: number }>();
        if (geojson.features && Array.isArray(geojson.features)) {
          for (const feature of geojson.features) {
            const regionId = feature.properties?.region_id;
            if (regionId && feature.geometry) {
              const center = computePolygonCenter(feature.geometry);
              if (center) {
                centersMap.set(regionId, center);
              }
            }
          }
        }
        centersRef.current = centersMap;

        return GeoJsonDataSource.load(geojson, {
          clampToGround: false,
          stroke: Color.fromCssColorString("#00ff9f"),
          strokeWidth: 1.5,
          fill: Color.fromCssColorString("#00e5ff").withAlpha(0.08),
        });
      })
      .then((dataSource) => {
        if (!active || !viewerRef.current) return;
        boundaryRef.current = dataSource;

        // Plot markers and labels dynamically from GeoJSON centroids
        for (const entity of dataSource.entities.values) {
          const properties = entity.properties?.getValue(JulianDate.now());
          const regionId =
            typeof properties?.region_id === "string" ? properties.region_id : "";
          const name = typeof properties?.name === "string" ? properties.name : regionId;
          const isRegion = properties?.level === "region";
          const center = centersRef.current.get(regionId);

          if (center) {
            entity.position = new ConstantPositionProperty(
              Cartesian3.fromDegrees(center.lng, center.lat, 0),
            );

            entity.point = new PointGraphics({
              pixelSize: new ConstantProperty(isRegion ? 10 : 7),
              color: new ConstantProperty(Color.fromCssColorString("#00ccff")),
              outlineColor: new ConstantProperty(Color.fromCssColorString("#05121a")),
              outlineWidth: new ConstantProperty(2),
              heightReference: new ConstantProperty(HeightReference.CLAMP_TO_GROUND),
              scaleByDistance: new ConstantProperty(new NearFarScalar(1.5e5, 1.3, 5e6, 0.4)),
              disableDepthTestDistance: new ConstantProperty(Number.POSITIVE_INFINITY),
            });

            entity.label = new LabelGraphics({
              text: new ConstantProperty(name),
              font: new ConstantProperty(
                isRegion
                  ? 'bold 14px "Segoe UI", system-ui, -apple-system, sans-serif'
                  : 'bold 11px "Segoe UI", system-ui, -apple-system, sans-serif',
              ),
              style: new ConstantProperty(LabelStyle.FILL_AND_OUTLINE),
              fillColor: new ConstantProperty(
                isRegion ? Color.WHITE : Color.fromCssColorString("#e0f7fa"),
              ),
              outlineColor: new ConstantProperty(Color.fromCssColorString("#05121a")),
              outlineWidth: new ConstantProperty(4),
              showBackground: new ConstantProperty(true),
              backgroundColor: new ConstantProperty(
                Color.fromCssColorString("rgba(5, 12, 22, 0.88)"),
              ),
              backgroundPadding: new ConstantProperty(new Cartesian2(7, 4)),
              verticalOrigin: new ConstantProperty(VerticalOrigin.BOTTOM),
              horizontalOrigin: new ConstantProperty(HorizontalOrigin.CENTER),
              pixelOffset: new ConstantProperty(new Cartesian2(0, -10)),
              heightReference: new ConstantProperty(HeightReference.CLAMP_TO_GROUND),
              scaleByDistance: new ConstantProperty(new NearFarScalar(2e5, 1.1, 4.5e6, 0.4)),
              disableDepthTestDistance: new ConstantProperty(Number.POSITIVE_INFINITY),
            });
          }
        }

        styleBoundaries(dataSource, selectedRegionId);
        dataSource.show = showBoundaries;
        void viewer.dataSources.add(dataSource);
        viewer.scene.requestRender();
      })
      .catch(() => {
        if (active) onImageryStatus("error");
      });

    void imageryPromise;

    return () => {
      active = false;
      clickHandler.destroy();
      hoverHandler.destroy();
      boundaryRef.current = null;
      worldRef.current = null;
      indiaRef.current = null;
      viewerRef.current = null;
      if (!viewer.isDestroyed()) viewer.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (boundaryRef.current) {
      styleBoundaries(boundaryRef.current, selectedRegionId);
      viewer?.scene.requestRender();
    }
    if (viewer && selectedRegionId && centersRef.current.has(selectedRegionId)) {
      const center = centersRef.current.get(selectedRegionId)!;
      const isRegion = selectedRegionId === "IN-MH-VID";
      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(
          center.lng,
          center.lat,
          isRegion ? 950_000 : 420_000,
        ),
        orientation: {
          heading: 0,
          pitch: -Math.PI / 2,
          roll: 0,
        },
        duration: 0.6,
      });
    }
  }, [selectedRegionId]);

  useEffect(() => {
    if (boundaryRef.current) {
      boundaryRef.current.show = showBoundaries;
      viewerRef.current?.scene.requestRender();
    }
  }, [showBoundaries]);

  useEffect(() => {
    if (worldRef.current) {
      worldRef.current.show = showWorldBoundaries;
      viewerRef.current?.scene.requestRender();
    }
  }, [showWorldBoundaries]);

  useEffect(() => {
    if (indiaRef.current) {
      indiaRef.current.show = showIndiaStates;
      viewerRef.current?.scene.requestRender();
    }
  }, [showIndiaStates]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const target = presets[preset];
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(
        target.longitude,
        target.latitude,
        target.height,
      ),
      orientation: {
        heading: 0,
        pitch: -Math.PI / 2,
        roll: 0,
      },
      duration: 0.7,
    });
  }, [preset]);

  const markerRef = useRef<Entity | null>(null);
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !marker) return;
    if (markerRef.current) viewer.entities.remove(markerRef.current);
    markerRef.current = viewer.entities.add({
      position: Cartesian3.fromDegrees(marker.lon, marker.lat),
      point: { pixelSize: 13, color: Color.fromCssColorString("#22d3ee"), outlineColor: Color.WHITE, outlineWidth: 2, heightReference: HeightReference.CLAMP_TO_GROUND },
      label: {
        text: marker.label,
        font: "600 13px Fira Sans, sans-serif",
        fillColor: Color.WHITE,
        outlineColor: Color.fromCssColorString("#050816"),
        outlineWidth: 4,
        style: LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: VerticalOrigin.BOTTOM,
        pixelOffset: new Cartesian2(0, -16),
        heightReference: HeightReference.CLAMP_TO_GROUND,
      },
    });
    const insideVidarbha = marker.lat > 19 && marker.lat < 22.5 && marker.lon > 76 && marker.lon < 81;
    if (!insideVidarbha) {
      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(marker.lon, marker.lat, 1_400_000),
        orientation: { heading: 0, pitch: -Math.PI / 2, roll: 0 },
        duration: 1.1,
      });
    }
    viewer.scene.requestRender();
  }, [marker?.lat, marker?.lon, marker?.label]);

  return (
    <div
      className="cesium-globe"
      ref={containerRef}
      aria-label="Interactive 3D globe — real satellite imagery — Vidarbha Earth System Trend Detective"
    />
  );
}
