import type { ApiListData } from '@/types/api'

export type ApiListResult<T> = {
  items: T[]
  total: number
}

export function normalizeApiList<T>(data: ApiListData<T>): ApiListResult<T> {
  if (Array.isArray(data)) {
    return {
      items: data,
      total: data.length,
    }
  }

  const items = data.items ?? []
  const total = data.meta?.total ?? items.length

  return {
    items,
    total,
  }
}
