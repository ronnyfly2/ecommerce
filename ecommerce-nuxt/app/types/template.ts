export type TemplateChannel = 'web'
export type TemplatePageType = 'home' | 'category'
export type TemplateStatus = 'draft' | 'published' | 'deprecated'
export type TemplateComponentKey =
  | 'hero'
  | 'banner'
  | 'product-grid'
  | 'rich-text'
  | 'cta'
  | 'category-strip'
  | 'flash-sale'
  | 'brand-carousel'
  | 'trust-badges'
  | 'promo-banners'

export interface TemplateMeta {
  templateKey: string
  channel: TemplateChannel
  pageType: TemplatePageType
  schemaVersion: string
}

export interface TemplateSectionBase {
  id: string
  componentKey: TemplateComponentKey
  order: number
  layoutWidth?: 'basic' | 'wide' | 'full'
  spacingY?: 'default' | 'compact' | 'none'
  spacingX?: 'default' | 'compact' | 'none'
  dataSource?: Record<string, unknown> | null
  visibilityRules?: Record<string, unknown> | null
}

export interface HeroProps {
  title: string
  subtitle?: string
  imageUrl?: string
  ctaLabel?: string
  ctaHref?: string
  backgroundColor?: string
  titleColor?: string
  subtitleColor?: string
  buttonBackgroundColor?: string
  buttonTextColor?: string
  slides?: HeroSlide[]
  autoPlay?: boolean
  autoPlayIntervalMs?: number
  showDots?: boolean
  showArrows?: boolean
  cardBorderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full'
  cardBorderVisible?: boolean
  cardBorderColor?: string
  cardBackgroundColor?: string
}

export interface HeroSlide {
  title: string
  subtitle?: string
  imageUrl?: string
  ctaLabel?: string
  ctaHref?: string
  imageLayout?: 'background' | 'side-left' | 'side-right'
  imageWidth?: 'quarter' | 'half'
  height?: 'compact' | 'tall' | 'screen'
  sideImageHeight?: 'match' | 'compact' | 'tall' | 'screen'
  imageFocus?: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  imageZoom?: number
  contentAlignment?: 'left' | 'center' | 'right'
  contentWidth?: 'narrow' | 'regular' | 'wide' | 'full'
  overlayColor?: string
  titleColor?: string
  titleBackgroundColor?: string
  titleBackgroundSize?: 'fit' | 'wide' | 'full'
  subtitleColor?: string
  subtitleBackgroundColor?: string
  subtitleBackgroundSize?: 'fit' | 'wide' | 'full'
  buttonBackgroundColor?: string
  buttonTextColor?: string
  buttonSize?: 'sm' | 'md' | 'lg'
}

export interface BannerProps {
  text: string
  tone?: 'info' | 'success' | 'warning' | 'danger'
  dismissible?: boolean
}

export interface ProductGridProps {
  title?: string
  source: 'featured' | 'new_arrivals' | 'by_category'
  categorySlug?: string
  limit?: number
  backgroundColor?: string
  titleColor?: string
  cardBackgroundColor?: string
  cardBorderColor?: string
  priceColor?: string
  placeholderImageBaseUrl?: string
}

export interface RichTextProps {
  title?: string
  body: string
}

export interface CtaProps {
  title: string
  description?: string
  buttonLabel: string
  buttonHref: string
}

export interface CategoryItem {
  label: string
  slug: string
  imageUrl?: string
  icon?: string
}

export interface CategoryStripProps {
  title?: string
  categories: CategoryItem[]
  backgroundColor?: string
  titleColor?: string
  itemBackgroundColor?: string
  itemTextColor?: string
  itemBorderColor?: string
}

export interface FlashSaleProps {
  title?: string
  endTime?: string
  source: 'featured' | 'new_arrivals' | 'by_category'
  categorySlug?: string
  limit?: number
  backgroundColor?: string
  titleColor?: string
  timerBackgroundColor?: string
  timerTextColor?: string
  cardBackgroundColor?: string
  cardBorderColor?: string
  priceColor?: string
  progressColor?: string
  placeholderImageBaseUrl?: string
}

export interface BrandItem {
  name: string
  logoUrl?: string
  slug?: string
}

export interface BrandCarouselProps {
  title?: string
  brands: BrandItem[]
  backgroundColor?: string
  titleColor?: string
  cardBackgroundColor?: string
  cardBorderColor?: string
}

export interface TrustBadge {
  icon?: string
  title: string
  description?: string
}

export interface TrustBadgesProps {
  badges: TrustBadge[]
  backgroundColor?: string
  titleColor?: string
  textColor?: string
}

export interface PromoBannerItem {
  imageUrl: string
  title?: string
  subtitle?: string
  href?: string
  textPosition?: 'top-left' | 'center' | 'bottom-left' | 'bottom-right'
}

export interface PromoBannersProps {
  banners: PromoBannerItem[]
  columns?: 2 | 3
  backgroundColor?: string
  overlayColor?: string
}

export type TemplateSection =
  | (TemplateSectionBase & { componentKey: 'hero'; props: HeroProps })
  | (TemplateSectionBase & { componentKey: 'banner'; props: BannerProps })
  | (TemplateSectionBase & { componentKey: 'product-grid'; props: ProductGridProps })
  | (TemplateSectionBase & { componentKey: 'rich-text'; props: RichTextProps })
  | (TemplateSectionBase & { componentKey: 'cta'; props: CtaProps })
  | (TemplateSectionBase & { componentKey: 'category-strip'; props: CategoryStripProps })
  | (TemplateSectionBase & { componentKey: 'flash-sale'; props: FlashSaleProps })
  | (TemplateSectionBase & { componentKey: 'brand-carousel'; props: BrandCarouselProps })
  | (TemplateSectionBase & { componentKey: 'trust-badges'; props: TrustBadgesProps })
  | (TemplateSectionBase & { componentKey: 'promo-banners'; props: PromoBannersProps })

export interface TemplateDocument {
  meta: TemplateMeta
  sections: TemplateSection[]
}

export interface TemplateResponse {
  id: string
  templateKey: string
  channel: TemplateChannel
  pageType: TemplatePageType
  version: number
  schemaVersion: string
  status: TemplateStatus
  content: TemplateDocument
  publishedAt: string | null
}

export interface ApiEnvelope<T> {
  data: T
}
