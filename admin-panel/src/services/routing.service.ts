export interface RoutingPoint {
  lat: number
  lng: number
}

export interface RouteResult {
  distanceMeters: number
  durationSeconds: number
  geometry: [number, number][] // [lat, lng]
}

function toOsrmPair(point: RoutingPoint): string {
  return `${point.lng},${point.lat}`
}

/**
 * Requests a driving route from OSRM public demo server.
 *
 * Note: This endpoint is public and best suited for MVP/prototyping.
 * For production, move to a dedicated routing provider or self-hosted OSRM.
 */
export async function fetchDrivingRoute(points: RoutingPoint[]): Promise<RouteResult> {
  if (points.length < 2) {
    throw new Error('Se requieren al menos dos puntos para calcular la ruta')
  }

  const coordinates = points.map(toOsrmPair).join(';')
  const params = new URLSearchParams({
    overview: 'full',
    geometries: 'geojson',
    steps: 'false',
  })

  const response = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${coordinates}?${params.toString()}`,
  )

  if (!response.ok) {
    throw new Error('No se pudo consultar el motor de rutas')
  }

  type OsrmRoute = {
    distance: number
    duration: number
    geometry?: {
      coordinates?: [number, number][] // [lng, lat]
    }
  }

  const payload = (await response.json()) as {
    code?: string
    routes?: OsrmRoute[]
    message?: string
  }

  const route = payload.routes?.[0]
  const coordinatesRaw = route?.geometry?.coordinates ?? []

  if (payload.code !== 'Ok' || !route || coordinatesRaw.length === 0) {
    throw new Error(payload.message || 'Ruta no disponible para los puntos seleccionados')
  }

  return {
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    geometry: coordinatesRaw
      .map(([lng, lat]) => [lat, lng] as [number, number])
      .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng)),
  }
}
