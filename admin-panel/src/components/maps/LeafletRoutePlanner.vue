<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import L from 'leaflet'
import { fetchDrivingRoute, type RoutingPoint } from '@/services/routing.service'

type CoordLike = string | number | null | undefined
type RouteStopInput = { lat?: CoordLike; lng?: CoordLike; label?: string }

const props = withDefaults(
  defineProps<{
    originLat?: CoordLike
    originLng?: CoordLike
    destinationLat?: CoordLike
    destinationLng?: CoordLike
    waypointLat?: CoordLike
    waypointLng?: CoordLike
    stops?: RouteStopInput[]
    originLabel?: string
    destinationLabel?: string
    waypointLabel?: string
    heightClass?: string
  }>(),
  {
    originLat: null,
    originLng: null,
    destinationLat: null,
    destinationLng: null,
    waypointLat: null,
    waypointLng: null,
    stops: () => [],
    originLabel: 'Origen',
    destinationLabel: 'Destino',
    waypointLabel: 'Parada',
    heightClass: 'h-72',
  },
)

const mapEl = ref<HTMLElement | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const distanceKm = ref<number | null>(null)
const durationMin = ref<number | null>(null)

let map: L.Map | null = null
let routeLayer: L.Polyline | null = null
let pointsLayer: L.LayerGroup | null = null

function parseCoord(value: CoordLike): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

const origin = computed<RoutingPoint | null>(() => {
  const lat = parseCoord(props.originLat)
  const lng = parseCoord(props.originLng)
  if (lat == null || lng == null) return null
  return { lat, lng }
})

const destination = computed<RoutingPoint | null>(() => {
  const lat = parseCoord(props.destinationLat)
  const lng = parseCoord(props.destinationLng)
  if (lat == null || lng == null) return null
  return { lat, lng }
})

const waypoint = computed<RoutingPoint | null>(() => {
  const lat = parseCoord(props.waypointLat)
  const lng = parseCoord(props.waypointLng)
  if (lat == null || lng == null) return null
  return { lat, lng }
})

const normalizedStops = computed<Array<{ point: RoutingPoint; label: string }>>(() => {
  return (props.stops ?? [])
    .map((stop, index) => {
      const lat = parseCoord(stop.lat)
      const lng = parseCoord(stop.lng)
      if (lat == null || lng == null) return null
      return {
        point: { lat, lng },
        label: stop.label?.trim() || `Parada ${index + 1}`,
      }
    })
    .filter((item): item is { point: RoutingPoint; label: string } => item != null)
})

const routePoints = computed<RoutingPoint[]>(() => {
  if (!origin.value) return []

  // Preferred mode: explicit ordered stops (A -> B -> C -> ...)
  if (normalizedStops.value.length > 0) {
    return [origin.value, ...normalizedStops.value.map((s) => s.point)]
  }

  // Backward compatibility mode.
  if (!destination.value) return []
  return waypoint.value ? [origin.value, waypoint.value, destination.value] : [origin.value, destination.value]
})

const routeLabels = computed<string[]>(() => {
  if (!origin.value || routePoints.value.length < 2) return []

  if (normalizedStops.value.length > 0) {
    return [props.originLabel, ...normalizedStops.value.map((s) => s.label)]
  }

  return waypoint.value
    ? [props.originLabel, props.waypointLabel, props.destinationLabel]
    : [props.originLabel, props.destinationLabel]
})

function clearLayers() {
  if (routeLayer && map) {
    map.removeLayer(routeLayer)
    routeLayer = null
  }
  if (pointsLayer && map) {
    map.removeLayer(pointsLayer)
    pointsLayer = null
  }
}

function renderPoints() {
  if (!map || routePoints.value.length < 2) return

  pointsLayer = L.layerGroup()

  routePoints.value.forEach((point, index) => {
    const color = index === 0 ? '#0284c7' : index === routePoints.value.length - 1 ? '#16a34a' : '#f59e0b'

    const marker = L.circleMarker([point.lat, point.lng], {
      radius: 7,
      weight: 2,
      color,
      fillColor: color,
      fillOpacity: 0.25,
    })
    marker.bindTooltip(`${routeLabels.value[index] ?? `Parada ${index + 1}`} (${index + 1})`, { direction: 'top' })
    marker.addTo(pointsLayer!)
  })

  pointsLayer.addTo(map)
}

async function drawRoute() {
  if (!map) return

  clearLayers()
  distanceKm.value = null
  durationMin.value = null
  error.value = null

  if (routePoints.value.length < 2) {
    return
  }

  loading.value = true
  try {
    const result = await fetchDrivingRoute(routePoints.value)
    routeLayer = L.polyline(result.geometry, {
      color: '#0ea5e9',
      weight: 5,
      opacity: 0.8,
      lineJoin: 'round',
    }).addTo(map)

    renderPoints()

    const bounds = routeLayer.getBounds()
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [28, 28] })
    }

    distanceKm.value = result.distanceMeters / 1000
    durationMin.value = result.durationSeconds / 60
  } catch (err) {
    renderPoints()
    const bounds = L.latLngBounds(routePoints.value.map((p) => [p.lat, p.lng] as [number, number]))
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [28, 28] })
    }
    error.value = err instanceof Error ? err.message : 'No se pudo calcular la ruta'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (!mapEl.value) return

  map = L.map(mapEl.value, {
    zoomControl: true,
    attributionControl: true,
  }).setView([-12.0464, -77.0428], 12)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map)

  void drawRoute()

  setTimeout(() => map?.invalidateSize(), 120)
})

watch(routePoints, () => {
  void drawRoute()
}, { deep: true })

onBeforeUnmount(() => {
  if (map) {
    map.remove()
    map = null
  }
})
</script>

<template>
  <div class="rounded-md border border-surface-200 overflow-hidden">
    <div class="px-3 py-2 border-b border-surface-200 bg-surface-50 text-xs text-surface-700 flex items-center justify-between gap-2">
      <span class="font-medium">Ruta logística</span>
      <span v-if="loading" class="text-info-700">Calculando...</span>
      <span v-else-if="distanceKm != null && durationMin != null" class="font-mono">
        {{ distanceKm.toFixed(1) }} km · {{ Math.round(durationMin) }} min
      </span>
      <span v-else class="text-muted">Sin datos suficientes</span>
    </div>

    <div :class="heightClass" ref="mapEl" />

    <div v-if="error" class="px-3 py-2 text-xs bg-warning-50 text-warning-700 border-t border-warning-200">
      {{ error }}
    </div>
  </div>
</template>
