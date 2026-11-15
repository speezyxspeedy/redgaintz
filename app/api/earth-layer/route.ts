import { NextRequest, NextResponse } from 'next/server'

const layerNames: Record<string, string> = {
  'Satellites Now': 'MODIS_Terra_CorrectedReflectance_TrueColor',
  'Visible Earth': 'BlueMarble_ShadedRelief_Bathymetry',
  'Air Temperature': 'AIRS_L3_Surface_Air_Temperature_Daily_Day',
  'Carbon Dioxide': 'OCO-2_Carbon_Dioxide_Total_Column_Average',
  'Carbon Monoxide': 'AIRS_L3_Carbon_Monoxide_500hPa_Volume_Mixing_Ratio_Daily_Day',
  'Chlorophyll': 'VIIRS_SNPP_L2_Chlorophyll_A',
  'Precipitation': 'IMERG_Precipitation_Rate',
  'Sea Level': 'JPL_MEaSUREs_L4_Sea_Surface_Height_Anomalies',
  'Sea Surface Temperature': 'GHRSST_L4_AVHRR-OI_Sea_Surface_Temperature',
  'Soil Moisture': 'SMAP_L4_Analyzed_Root_Zone_Soil_Moisture',
  Ozone: 'OMI_Ozone_DOAS_Total_Column',
  'Water Vapor': 'AMSRE_Columnar_Water_Vapor_Day',
  'Water Storage': 'GRACE_Tellus_Liquid_Water_Equivalent_Thickness_Mascon_CRI',
  'Nitrous Oxide': 'MLS_N2O_46hPa_Day',
}

export async function GET(request: NextRequest) {
  const requestedLayer = request.nextUrl.searchParams.get('layer') ?? 'Visible Earth'
  const layer = layerNames[requestedLayer]

  if (!layer) {
    return NextResponse.json({ error: 'Unsupported Earth data layer.' }, { status: 400 })
  }

  const today = new Date().toISOString().slice(0, 10)
  const requestedDate = request.nextUrl.searchParams.get('date') ?? today
  if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate) || requestedDate > today || requestedDate < '2000-01-01') {
    return NextResponse.json({ error: 'Choose a valid imagery date from 2000 through today.' }, { status: 400 })
  }

  const url = new URL('https://wvs.earthdata.nasa.gov/api/v1/snapshot')
  url.searchParams.set('REQUEST', 'GetSnapshot')
  url.searchParams.set('TIME', requestedDate)
  url.searchParams.set('BBOX', '-90,-180,90,180')
  url.searchParams.set('CRS', 'EPSG:4326')
  url.searchParams.set('LAYERS', layer)
  url.searchParams.set('FORMAT', 'image/jpeg')
  url.searchParams.set('WIDTH', '1600')
  url.searchParams.set('HEIGHT', '800')

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000), next: { revalidate: 3600 } })
    const contentType = response.headers.get('content-type') ?? ''
    if (!response.ok || !contentType.startsWith('image/')) {
      return NextResponse.json({ error: `NASA Worldview does not currently have an image for the ${requestedLayer} layer on ${requestedDate}.` }, { status: 502 })
    }

    return new NextResponse(await response.arrayBuffer(), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
        'X-Data-Source': 'NASA GIBS / Worldview',
        'X-Data-Layer': requestedLayer,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Unable to reach NASA Worldview imagery.' }, { status: 502 })
  }
}
