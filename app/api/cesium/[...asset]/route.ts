import { readFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

type AssetRouteContext = { params: Promise<{ asset: string[] }> }

const allowedRoots = new Set(['Assets', 'ThirdParty', 'Widgets', 'Workers'])
const contentTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.glsl': 'text/plain; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ktx2': 'image/ktx2',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
}

export async function GET(_request: Request, { params }: AssetRouteContext) {
  const { asset } = await params
  if (!asset.length || !allowedRoots.has(asset[0]) || asset.some((part) => part === '.' || part === '..' || part.includes('\\') || part.includes('\0'))) {
    return new NextResponse(null, { status: 404 })
  }

  const cesiumRoot = resolve(process.cwd(), 'node_modules', 'cesium', 'Build', 'Cesium')
  const assetPath = resolve(cesiumRoot, ...asset)
  if (!assetPath.startsWith(`${cesiumRoot}${sep}`)) return new NextResponse(null, { status: 404 })

  try {
    const data = await readFile(assetPath)
    return new NextResponse(data, {
      headers: {
        'Cache-Control': 'public, max-age=3600',
        'Content-Type': contentTypes[extname(assetPath).toLowerCase()] ?? 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return new NextResponse(null, { status: 404 })
  }
}