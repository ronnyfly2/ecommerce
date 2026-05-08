type TemplateSection = {
  id: string
  componentKey: string
  order: number
  props: Record<string, unknown>
}

export type ThemePreset = {
  id: string
  name: string
  description: string
  swatches: string[]
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'minimal-clean',
    name: 'Minimal Clean',
    description: 'Claro, elegante y neutro. Ideal para moda y catalogo general.',
    swatches: ['#f8fafc', '#111827', '#dc2626', '#ffffff']
  },
  {
    id: 'sunset-sale',
    name: 'Sunset Sale',
    description: 'Calido y comercial, pensado para promociones y ofertas.',
    swatches: ['#fff7ed', '#9a3412', '#ea580c', '#7c2d12']
  },
  {
    id: 'emerald-fresh',
    name: 'Emerald Fresh',
    description: 'Fresco y confiable, funciona muy bien para tiendas wellness.',
    swatches: ['#ecfdf5', '#065f46', '#10b981', '#064e3b']
  },
  {
    id: 'luxury-noir',
    name: 'Luxury Noir',
    description: 'Premium y sobrio para marcas de lujo.',
    swatches: ['#111827', '#f9fafb', '#d4af37', '#1f2937']
  }
]

function patchByTheme(themeId: string): Record<string, Record<string, unknown>> {
  const map: Record<string, Record<string, Record<string, unknown>>> = {
    'minimal-clean': {
      hero: {
        backgroundColor: '#f8fafc',
        titleColor: '#0f172a',
        subtitleColor: '#475569',
        buttonBackgroundColor: '#111827',
        buttonTextColor: '#ffffff'
      },
      'category-strip': {
        backgroundColor: '#ffffff',
        titleColor: '#111827',
        itemBackgroundColor: '#f3f4f6',
        itemTextColor: '#374151',
        itemBorderColor: '#e5e7eb'
      },
      'product-grid': {
        backgroundColor: '#ffffff',
        titleColor: '#111827',
        cardBackgroundColor: '#ffffff',
        cardBorderColor: '#e5e7eb',
        priceColor: '#dc2626'
      },
      'flash-sale': {
        backgroundColor: '#ffffff',
        titleColor: '#111827',
        timerBackgroundColor: '#111827',
        timerTextColor: '#ffffff',
        cardBackgroundColor: '#ffffff',
        cardBorderColor: '#e5e7eb',
        priceColor: '#ef4444',
        progressColor: '#f87171'
      },
      'brand-carousel': {
        backgroundColor: '#f9fafb',
        titleColor: '#111827',
        cardBackgroundColor: '#ffffff',
        cardBorderColor: '#e5e7eb'
      },
      'trust-badges': {
        backgroundColor: '#ffffff',
        titleColor: '#111827',
        textColor: '#6b7280'
      },
      'promo-banners': {
        backgroundColor: '#ffffff',
        overlayColor: '#000000'
      }
    },
    'sunset-sale': {
      hero: {
        backgroundColor: '#fff7ed',
        titleColor: '#9a3412',
        subtitleColor: '#7c2d12',
        buttonBackgroundColor: '#ea580c',
        buttonTextColor: '#ffffff'
      },
      'category-strip': {
        backgroundColor: '#fff7ed',
        titleColor: '#9a3412',
        itemBackgroundColor: '#ffedd5',
        itemTextColor: '#9a3412',
        itemBorderColor: '#fdba74'
      },
      'product-grid': {
        backgroundColor: '#fff7ed',
        titleColor: '#9a3412',
        cardBackgroundColor: '#ffffff',
        cardBorderColor: '#fdba74',
        priceColor: '#ea580c'
      },
      'flash-sale': {
        backgroundColor: '#fff7ed',
        titleColor: '#9a3412',
        timerBackgroundColor: '#7c2d12',
        timerTextColor: '#ffffff',
        cardBackgroundColor: '#ffffff',
        cardBorderColor: '#fdba74',
        priceColor: '#ea580c',
        progressColor: '#fb923c'
      },
      'brand-carousel': {
        backgroundColor: '#fffbeb',
        titleColor: '#92400e',
        cardBackgroundColor: '#ffffff',
        cardBorderColor: '#fdba74'
      },
      'trust-badges': {
        backgroundColor: '#fff7ed',
        titleColor: '#9a3412',
        textColor: '#7c2d12'
      },
      'promo-banners': {
        backgroundColor: '#fff7ed',
        overlayColor: '#7c2d12'
      }
    },
    'emerald-fresh': {
      hero: {
        backgroundColor: '#ecfdf5',
        titleColor: '#065f46',
        subtitleColor: '#047857',
        buttonBackgroundColor: '#10b981',
        buttonTextColor: '#ffffff'
      },
      'category-strip': {
        backgroundColor: '#ecfdf5',
        titleColor: '#065f46',
        itemBackgroundColor: '#d1fae5',
        itemTextColor: '#065f46',
        itemBorderColor: '#86efac'
      },
      'product-grid': {
        backgroundColor: '#ecfdf5',
        titleColor: '#065f46',
        cardBackgroundColor: '#ffffff',
        cardBorderColor: '#a7f3d0',
        priceColor: '#059669'
      },
      'flash-sale': {
        backgroundColor: '#ecfdf5',
        titleColor: '#065f46',
        timerBackgroundColor: '#065f46',
        timerTextColor: '#ffffff',
        cardBackgroundColor: '#ffffff',
        cardBorderColor: '#a7f3d0',
        priceColor: '#10b981',
        progressColor: '#34d399'
      },
      'brand-carousel': {
        backgroundColor: '#f0fdf4',
        titleColor: '#065f46',
        cardBackgroundColor: '#ffffff',
        cardBorderColor: '#86efac'
      },
      'trust-badges': {
        backgroundColor: '#ecfdf5',
        titleColor: '#065f46',
        textColor: '#047857'
      },
      'promo-banners': {
        backgroundColor: '#ecfdf5',
        overlayColor: '#064e3b'
      }
    },
    'luxury-noir': {
      hero: {
        backgroundColor: '#111827',
        titleColor: '#f9fafb',
        subtitleColor: '#d1d5db',
        buttonBackgroundColor: '#d4af37',
        buttonTextColor: '#111827'
      },
      'category-strip': {
        backgroundColor: '#111827',
        titleColor: '#f9fafb',
        itemBackgroundColor: '#1f2937',
        itemTextColor: '#e5e7eb',
        itemBorderColor: '#374151'
      },
      'product-grid': {
        backgroundColor: '#111827',
        titleColor: '#f9fafb',
        cardBackgroundColor: '#1f2937',
        cardBorderColor: '#374151',
        priceColor: '#f59e0b'
      },
      'flash-sale': {
        backgroundColor: '#111827',
        titleColor: '#f9fafb',
        timerBackgroundColor: '#d4af37',
        timerTextColor: '#111827',
        cardBackgroundColor: '#1f2937',
        cardBorderColor: '#374151',
        priceColor: '#f59e0b',
        progressColor: '#fbbf24'
      },
      'brand-carousel': {
        backgroundColor: '#0f172a',
        titleColor: '#f9fafb',
        cardBackgroundColor: '#1f2937',
        cardBorderColor: '#374151'
      },
      'trust-badges': {
        backgroundColor: '#111827',
        titleColor: '#f9fafb',
        textColor: '#d1d5db'
      },
      'promo-banners': {
        backgroundColor: '#111827',
        overlayColor: '#000000'
      }
    }
  }

  return map[themeId] ?? map['minimal-clean']
}

export function applyThemeToSections(sections: TemplateSection[], themeId: string): TemplateSection[] {
  const patchMap = patchByTheme(themeId)

  return sections.map((section) => {
    const patch = patchMap[section.componentKey]
    if (!patch) return section

    return {
      ...section,
      props: {
        ...section.props,
        ...patch
      }
    }
  })
}
