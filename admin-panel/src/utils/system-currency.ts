import type { Currency } from '@/types/api'

const STORAGE_CODE_KEY = 'system-default-currency-code'
const STORAGE_RATE_KEY = 'system-default-currency-rate'

let defaultCurrencyCode = 'USD'
let defaultExchangeRateToUsd = 1

function setPersistedState(code: string, exchangeRateToUsd: number) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(STORAGE_CODE_KEY, code)
  window.localStorage.setItem(STORAGE_RATE_KEY, String(exchangeRateToUsd))
}

function readPersistedState() {
  if (typeof window === 'undefined') {
    return
  }

  const code = window.localStorage.getItem(STORAGE_CODE_KEY)
  const rate = Number(window.localStorage.getItem(STORAGE_RATE_KEY) || '1')

  if (code) {
    defaultCurrencyCode = code
  }

  if (Number.isFinite(rate) && rate > 0) {
    defaultExchangeRateToUsd = rate
  }
}

readPersistedState()

export function setSystemCurrency(code: string, exchangeRateToUsd = 1) {
  const normalizedCode = (code || 'USD').trim().toUpperCase()
  const normalizedRate = Number.isFinite(exchangeRateToUsd) && exchangeRateToUsd > 0
    ? exchangeRateToUsd
    : 1

  defaultCurrencyCode = normalizedCode
  defaultExchangeRateToUsd = normalizedRate
  setPersistedState(normalizedCode, normalizedRate)
}

export function setSystemCurrencyFromList(currencies: Currency[]) {
  const activeCurrencies = currencies.filter((item) => item.isActive)
  const selected = activeCurrencies.find((item) => item.isDefault)
    ?? activeCurrencies.find((item) => item.code === 'USD')
    ?? activeCurrencies[0]

  if (!selected) {
    setSystemCurrency('USD', 1)
    return
  }

  setSystemCurrency(selected.code, Number(selected.exchangeRateToUsd) || 1)
}

export function getSystemCurrencyCode() {
  return defaultCurrencyCode
}

export function convertUsdToSystemCurrency(value: number | string) {
  const numeric = Number(value || 0)
  if (!Number.isFinite(numeric)) {
    return 0
  }

  return Number((numeric * defaultExchangeRateToUsd).toFixed(2))
}
