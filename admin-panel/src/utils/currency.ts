import { getSystemCurrencyCode } from '@/utils/system-currency'

export function formatMoney(value: string | number, currencyCode = '', locale = 'es-PE') {
  const resolvedCurrency = currencyCode || getSystemCurrencyCode()
  return Number(value).toLocaleString(locale, {
    style: 'currency',
    currency: resolvedCurrency,
    minimumFractionDigits: 0,
  })
}
