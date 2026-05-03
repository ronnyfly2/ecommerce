import { computed, type Ref } from 'vue'
import { haversineKm } from '@/utils/geo'
import type { Carrier } from '@/services/shipments.service'

// ── Types ──────────────────────────────────────────────────────────────────────

export type SuggestionReason = 'OWN_FLEET_IN_COVERAGE' | 'EXTERNAL_COURIER_FALLBACK'

export interface CarrierSuggestion {
  carrier: Carrier
  reason: SuggestionReason
  /** Distance from the own-fleet hub to the destination (only for OWN_FLEET_IN_COVERAGE) */
  distanceKm?: number
  /** Configured coverage radius in km (only for OWN_FLEET_IN_COVERAGE) */
  coverageRadiusKm?: number
}

type MaybeCoord = string | number | null | undefined

// ── Helper ─────────────────────────────────────────────────────────────────────

function getOperational(carrier: Carrier): Record<string, unknown> {
  return (carrier.config?.operational as Record<string, unknown> | undefined) ?? {}
}

// ── Composable ─────────────────────────────────────────────────────────────────

/**
 * Reactive composable that suggests the best carrier for a given delivery destination.
 *
 * Algorithm:
 * 1. For each enabled **own-fleet** carrier that has a configured hub coordinate,
 *    compute the Haversine distance to the destination.
 *    If `distance ≤ coverageRadiusKm` → suggest that carrier (OWN_FLEET_IN_COVERAGE).
 *    Own-fleet carriers are tried in ascending `displayOrder`.
 * 2. If no own-fleet carrier covers the destination, suggest the first enabled
 *    **external** courier sorted by displayOrder (EXTERNAL_COURIER_FALLBACK).
 * 3. Returns `null` when coordinates are missing or invalid.
 *
 * The suggestion is non-blocking — callers may always override it.
 */
export function useCarrierSuggestion(
  carriers: Ref<Carrier[]>,
  lat: Ref<MaybeCoord>,
  lng: Ref<MaybeCoord>,
) {
  const suggestion = computed<CarrierSuggestion | null>(() => {
    const latNum = lat.value != null && lat.value !== '' ? Number(lat.value) : NaN
    const lngNum = lng.value != null && lng.value !== '' ? Number(lng.value) : NaN

    if (!isFinite(latNum) || !isFinite(lngNum)) return null

    // 1 ── Own-fleet carriers within coverage radius ─────────────────────────
    const ownFleet = carriers.value
      .filter((c) => {
        if (!c.isEnabled) return false
        const op = getOperational(c)
        return (
          op.operationMode === 'OWN_FLEET' &&
          op.defaultHubLat != null && op.defaultHubLat !== '' &&
          op.defaultHubLng != null && op.defaultHubLng !== ''
        )
      })
      .sort((a, b) => a.displayOrder - b.displayOrder)

    for (const c of ownFleet) {
      const op = getOperational(c)
      const hubLat = Number(op.defaultHubLat)
      const hubLng = Number(op.defaultHubLng)
      if (!isFinite(hubLat) || !isFinite(hubLng)) continue

      // Default coverage: 30 km if not explicitly configured
      const coverageRadiusKm =
        op.coverageRadiusKm != null && Number(op.coverageRadiusKm) > 0
          ? Number(op.coverageRadiusKm)
          : 30

      const distanceKm = haversineKm(hubLat, hubLng, latNum, lngNum)

      if (distanceKm <= coverageRadiusKm) {
        return { carrier: c, reason: 'OWN_FLEET_IN_COVERAGE', distanceKm, coverageRadiusKm }
      }
    }

    // 2 ── Fallback: first enabled external courier ───────────────────────────
    const external = carriers.value
      .filter((c) => {
        if (!c.isEnabled) return false
        const op = getOperational(c)
        return op.operationMode !== 'OWN_FLEET'
      })
      .sort((a, b) => a.displayOrder - b.displayOrder)

    if (external.length > 0) {
      return { carrier: external[0], reason: 'EXTERNAL_COURIER_FALLBACK' }
    }

    return null
  })

  return { suggestion }
}
