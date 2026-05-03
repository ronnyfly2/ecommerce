<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import L from 'leaflet'
import markerIcon2xUrl from 'leaflet/dist/images/marker-icon-2x.png'
import markerIconUrl from 'leaflet/dist/images/marker-icon.png'
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png'

type Suggestion = {
  displayName: string
  lat: number
  lng: number
}

const props = withDefaults(
  defineProps<{
    lat?: string
    lng?: string
    address?: string
    heightClass?: string
    countryCode?: string
  }>(),
  {
    lat: '',
    lng: '',
    address: '',
    heightClass: 'h-64',
    countryCode: '',
  },
)

const emit = defineEmits<{
  'update:lat': [value: string]
  'update:lng': [value: string]
  'update:address': [value: string]
}>()

const mapEl = ref<HTMLElement | null>(null)
const addressInput = ref(props.address)
const suggestions = ref<Suggestion[]>([])
const searching = ref(false)
const dropdownOpen = ref(false)

let map: L.Map | null = null
let marker: L.Marker | null = null
let searchTimer: ReturnType<typeof setTimeout> | null = null
let blurTimer: ReturnType<typeof setTimeout> | null = null
let activeFetchController: AbortController | null = null

const DEFAULT_CENTER: L.LatLngExpression = [-12.0464, -77.0428]
const DEFAULT_ZOOM = 13

function parseCoord(value: string | undefined): number | null {
  if (!value) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function currentLatLng(): L.LatLng | null {
  const lat = parseCoord(props.lat)
  const lng = parseCoord(props.lng)
  if (lat == null || lng == null) return null
  return L.latLng(lat, lng)
}

function setMarker(lat: number, lng: number) {
  if (!map) return

  const point = L.latLng(lat, lng)

  if (!marker) {
    marker = L.marker(point, { draggable: true }).addTo(map)
    marker.on('dragend', () => {
      const dragged = marker?.getLatLng()
      if (!dragged) return
      emit('update:lat', dragged.lat.toFixed(6))
      emit('update:lng', dragged.lng.toFixed(6))
      void reverseGeocode(dragged.lat, dragged.lng)
    })
  } else {
    marker.setLatLng(point)
  }

  emit('update:lat', lat.toFixed(6))
  emit('update:lng', lng.toFixed(6))
}

async function reverseGeocode(lat: number, lng: number) {
  try {
    const params = new URLSearchParams({
      format: 'jsonv2',
      lat: String(lat),
      lon: String(lng),
    })
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
      headers: {
        'Accept-Language': 'es',
      },
    })
    if (!res.ok) return
    const data = (await res.json()) as { display_name?: string }
    if (data.display_name) {
      addressInput.value = data.display_name
      emit('update:address', data.display_name)
    }
  } catch {
    // Non-blocking best-effort reverse geocoding.
  }
}

async function fetchSuggestions(query: string) {
  activeFetchController?.abort()
  activeFetchController = new AbortController()

  searching.value = true
  try {
    async function fetchPhotonSuggestions() {
      const photonParams = new URLSearchParams({
        q: query,
        limit: '6',
      })

      const photonRes = await fetch(`https://photon.komoot.io/api/?${photonParams.toString()}`, {
        signal: activeFetchController?.signal,
      })

      if (!photonRes.ok) {
        suggestions.value = []
        return
      }

      type PhotonFeature = {
        properties?: { name?: string; city?: string; state?: string; country?: string }
        geometry?: { coordinates?: [number, number] }
      }

      const photonData = (await photonRes.json()) as { features?: PhotonFeature[] }
      suggestions.value = (photonData.features ?? [])
        .map((feature) => {
          const coords = feature.geometry?.coordinates
          const lng = coords?.[0]
          const lat = coords?.[1]
          const p = feature.properties
          const label = [p?.name, p?.city, p?.state, p?.country].filter(Boolean).join(', ')
          return {
            displayName: label || 'Direccion encontrada',
            lat: Number(lat),
            lng: Number(lng),
          }
        })
        .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng))
    }

    const params = new URLSearchParams({
      q: query,
      format: 'jsonv2',
      addressdetails: '1',
      limit: '6',
    })
    if (props.countryCode.trim()) {
      params.set('countrycodes', props.countryCode.trim().toLowerCase())
    }

    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      signal: activeFetchController.signal,
      headers: {
        'Accept-Language': 'es',
      },
    })

    if (!res.ok) {
      await fetchPhotonSuggestions()
      return
    }

    const data = (await res.json()) as Array<{ display_name: string; lat: string; lon: string }>
    suggestions.value = data
      .map((item) => ({
        displayName: item.display_name,
        lat: Number(item.lat),
        lng: Number(item.lon),
      }))
      .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng))

    if (suggestions.value.length === 0) {
      await fetchPhotonSuggestions()
    }
  } catch {
    suggestions.value = []
  } finally {
    searching.value = false
  }
}

function chooseSuggestion(item: Suggestion) {
  addressInput.value = item.displayName
  emit('update:address', item.displayName)
  setMarker(item.lat, item.lng)
  map?.setView([item.lat, item.lng], 16)
  dropdownOpen.value = false
  suggestions.value = []
}

function handleFocus() {
  if (blurTimer) {
    clearTimeout(blurTimer)
    blurTimer = null
  }
  dropdownOpen.value = suggestions.value.length > 0
}

function handleBlur() {
  blurTimer = setTimeout(() => {
    dropdownOpen.value = false
  }, 140)
}

function chooseFirstSuggestion() {
  if (suggestions.value.length > 0) {
    chooseSuggestion(suggestions.value[0])
  }
}

function handleInput() {
  emit('update:address', addressInput.value)

  if (searchTimer) clearTimeout(searchTimer)

  const query = addressInput.value.trim()
  if (query.length < 3) {
    suggestions.value = []
    dropdownOpen.value = false
    searching.value = false
    return
  }

  dropdownOpen.value = true
  searchTimer = setTimeout(() => {
    void fetchSuggestions(query)
  }, 300)
}

function handleMapClick(e: L.LeafletMouseEvent) {
  setMarker(e.latlng.lat, e.latlng.lng)
  void reverseGeocode(e.latlng.lat, e.latlng.lng)
}

onMounted(() => {
  // Leaflet + Vite: the default icon relies on _getIconUrl which breaks with bundlers.
  // Deleting it (not just setting to undefined) forces Leaflet to use mergeOptions values.
  delete (L.Icon.Default.prototype as L.Icon.Default & { _getIconUrl?: unknown })._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2xUrl,
    iconUrl: markerIconUrl,
    shadowUrl: markerShadowUrl,
  })

  if (!mapEl.value) return

  map = L.map(mapEl.value).setView(DEFAULT_CENTER, DEFAULT_ZOOM)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map)

  map.on('click', handleMapClick)

  const initial = currentLatLng()
  if (initial) {
    setMarker(initial.lat, initial.lng)
    map.setView(initial, 15)
  }

  setTimeout(() => {
    map?.invalidateSize()
  }, 140)
})

watch(
  () => props.address,
  (value) => {
    if (value !== addressInput.value) {
      addressInput.value = value
    }
  },
)

watch(
  () => [props.lat, props.lng],
  () => {
    const point = currentLatLng()
    if (!point) return
    setMarker(point.lat, point.lng)
  },
)

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer)
  if (blurTimer) clearTimeout(blurTimer)
  activeFetchController?.abort()
  if (map) {
    map.off('click', handleMapClick)
    map.remove()
    map = null
  }
})
</script>

<template>
  <div class="space-y-2">
    <label class="text-sm font-medium text-surface-800">Dirección del hub (autocompletar)</label>
    <div class="relative">
      <input
        v-model="addressInput"
        type="text"
        class="w-full rounded-md border border-surface-300 px-3 py-2 text-sm"
        placeholder="Escribe una dirección (ej: Av. Javier Prado 4200, Lima)"
        @input="handleInput"
        @focus="handleFocus"
        @blur="handleBlur"
        @keydown.enter.prevent="chooseFirstSuggestion"
      />
      <div
        v-if="dropdownOpen"
        class="absolute z-1200 mt-1 max-h-52 w-full overflow-auto rounded-md border border-surface-200 bg-white shadow"
      >
        <p v-if="searching" class="px-3 py-2 text-xs text-muted">Buscando…</p>
        <button
          v-for="item in suggestions"
          :key="`${item.lat}-${item.lng}-${item.displayName}`"
          type="button"
          class="block w-full border-b border-surface-100 px-3 py-2 text-left text-xs hover:bg-surface-50"
          @click="chooseSuggestion(item)"
        >
          {{ item.displayName }}
        </button>
        <p v-if="!searching && suggestions.length === 0" class="px-3 py-2 text-xs text-muted">
          Sin coincidencias.
        </p>
      </div>
    </div>

    <div :class="['relative z-0 overflow-hidden rounded-md border border-surface-200', heightClass]">
      <div ref="mapEl" class="h-full w-full"></div>
    </div>

    <p class="text-xs text-muted">
      Click en el mapa o arrastra el marcador para actualizar latitud y longitud.
    </p>
  </div>
</template>
