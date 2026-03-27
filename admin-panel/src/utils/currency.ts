import { getSystemCurrencyCode } from '@/utils/system-currency'

export function formatMoney(value: string | number, currencyCode = '', locale = 'es-PE') {
  const resolvedCurrency = currencyCode || getSystemCurrencyCode()
  const numeric = Number(value)

  return (Number.isFinite(numeric) ? numeric : 0).toLocaleString(locale, {
    style: 'currency',
    currency: resolvedCurrency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
