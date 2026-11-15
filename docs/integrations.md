# Earth Trends Integrations

## Current architecture

Earth Trends runs on Next.js App Router with React and TypeScript. NASA EONET supplies open events, CelesTrak GP elements are propagated with SGP4 on the server, and NASA GIBS supplies the visible-Earth base and dated science imagery. Google Maps 3D is loaded in the browser only when a restricted API key is configured; the NASA/Three.js globe remains the local fallback.

## CesiumJS globe

CesiumJS is the default 3D engine. It provides globe rotation, touch and mouse camera controls, camera fly-to, dynamic imagery layers, and live satellite entities. The app serves Cesium's worker, widget, and imagery assets from the installed `cesium` package at `/api/cesium/*`; those package assets are not copied into the repository.

Without an ion token, the globe uses the full-world NASA Blue Marble image and dated NASA GIBS overlays on an ellipsoid. Set `NEXT_PUBLIC_CESIUM_ION_ACCESS_TOKEN` in `.env.local` to enable Cesium ion World Imagery aerial tiles and global terrain (asset 1). The browser token is necessarily public: create a token restricted to the needed assets and configure allowed domains in Cesium ion. Check ion's current usage limits and pricing before production use. When the token is absent or invalid, the globe remains interactive and uses the NASA imagery path; no terrain exaggeration or elevation data is fabricated.

Cesium and Google Maps 3D are separate map engines, so the top-bar selector switches between them. Google Maps 3D still requires its own `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, an enabled Maps JavaScript API, billing, and HTTP-referrer restrictions. The NASA Three.js globe remains selectable as a lightweight fallback. Google 3D supports satellite/hybrid basemaps and camera operations but does not accept arbitrary Earth Engine raster tiles; Cesium can accept georeferenced imagery layers when served from a compatible tile endpoint.

## Google Maps 3D

Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`. In Google Cloud, enable the Maps JavaScript API, attach a billing account, and restrict the browser key to the deployed HTTP referrers and the Maps JavaScript API. Set usage quotas and budget alerts. The 3D Maps JavaScript API uses the Maps 3D/Immersive Maps billing SKU; pricing and monthly no-cost thresholds vary by account and region. Place autocomplete is provided through OpenStreetMap Nominatim in this project, so no Places API key or additional Places SKU is required.

The official Maps 3D element supports satellite, hybrid, and roadmap styles, plus range, tilt, heading, interactive markers, and camera fly-to animations. This app uses the satellite and hybrid modes. A 2D/3D toggle is intentionally omitted because `Map3DElement` is a 3D element, not a paired 2D map. Google Maps 3D documents vector markers, polylines, and polygons; it does not provide a general raster tile overlay surface for Earth Engine imagery.

## Place search

`GET /api/locations/search?q=...` proxies debounced searches to OpenStreetMap Nominatim, caches responses, and returns display labels and coordinates. The UI attributes OpenStreetMap contributors. Keep the 1-request-per-second application limit, use caching, and do not send autocomplete requests on every keystroke.

## Earth Engine service contract

The Next.js route `POST /api/analysis/{ndvi|deforestation|land-cover|temperature|change-detection}` validates the requested GeoJSON polygon and year range, then forwards it server-to-server to `EARTH_ENGINE_API_URL/api/analysis/{kind}`. `EARTH_ENGINE_API_TOKEN` is sent only in the server-side Authorization header. `GET /api/analysis/history` forwards to `/api/analysis/history`.

No FastAPI service or Earth Engine credentials are present in this repository. Until `EARTH_ENGINE_API_URL` is configured, analysis requests return HTTP 503; no scientific values are fabricated. The service should authenticate to Earth Engine using a backend-only service account or Application Default Credentials and return the actual dataset, processing period, job state, measured statistics, and optional AI-authored explanations as separate fields. Suitable inputs include Sentinel-2 surface reflectance with cloud masking for NDVI, an explicitly selected forest-loss dataset/threshold for deforestation, a documented land-cover product, and Landsat Collection 2 surface temperature with its scale/offset applied.

Earth Engine raster output is not directly accepted as an arbitrary raster overlay by Google's Maps 3D element. Return a georeferenced raster/tile service or an equirectangular visualization for the Three.js renderer, or publish a separate supported 3D Tiles workflow. Keep vector AOIs/results as GeoJSON for Maps 3D polygon elements. Do not silently claim raster layers are displayed on the Google map when they are not.

## Supabase and user data

There is no Supabase project configuration, authentication flow, or schema in this repository. Saved places currently live in browser local storage and are labeled as device-local. No tables or RLS policies were created. Before Supabase persistence is added, inspect the target project's existing schema and auth model, then add user-scoped RLS policies for saved locations, analysis jobs, and result metadata. Never use a service-role key in browser code.

## Backend environment

The `.env.example` variables are placeholders. Keep Earth Engine service-account credentials on the separately deployed analysis backend (for example, Application Default Credentials or a secret-mounted credential file); do not place a private key in a `NEXT_PUBLIC_` variable. The root app only needs the backend URL and optional server-to-server token.