import { http } from './http'
import type { ApiResponse, Currency, CreateCurrencyDto } from '@/types/api'

const CURRENCIES_CACHE_MS = 30_000

let currenciesCache: Currency[] | null = null
let currenciesCacheAt = 0
let currenciesInFlight: Promise<Currency[]> | null = null

function invalidateCurrenciesCache() {
  currenciesCache = null
  currenciesCacheAt = 0
}

export const currenciesService = {
  async list(options?: { force?: boolean }) {
    const force = options?.force ?? false
    const now = Date.now()

    if (!force && currenciesCache && now - currenciesCacheAt < CURRENCIES_CACHE_MS) {
      return currenciesCache
    }

    if (!force && currenciesInFlight) {
      return currenciesInFlight
    }

    currenciesInFlight = http
      .get<ApiResponse<Currency[]>>('/currencies')
      .then((res) => {
        currenciesCache = res.data.data
        currenciesCacheAt = Date.now()
        return currenciesCache
      })
      .finally(() => {
        currenciesInFlight = null
      })

    return currenciesInFlight
  },

  async create(dto: CreateCurrencyDto) {
    invalidateCurrenciesCache()
    const res = await http.post<ApiResponse<Currency>>('/currencies', dto)
    return res.data.data
  },

  async update(id: string, dto: Partial<CreateCurrencyDto>) {
    invalidateCurrenciesCache()
    const res = await http.patch<ApiResponse<Currency>>(`/currencies/${id}`, dto)
    return res.data.data
  },

  async remove(id: string) {
    invalidateCurrenciesCache()
    await http.delete(`/currencies/${id}`)
  },
}
