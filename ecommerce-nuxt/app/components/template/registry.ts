import type { Component } from 'vue'
import BannerBlock from '~/components/template/blocks/BannerBlock.vue'
import BrandCarouselBlock from '~/components/template/blocks/BrandCarouselBlock.vue'
import CategoryStripBlock from '~/components/template/blocks/CategoryStripBlock.vue'
import CtaBlock from '~/components/template/blocks/CtaBlock.vue'
import FlashSaleBlock from '~/components/template/blocks/FlashSaleBlock.vue'
import HeroBlock from '~/components/template/blocks/HeroBlock.vue'
import ProductGridBlock from '~/components/template/blocks/ProductGridBlock.vue'
import PromoBannersBlock from '~/components/template/blocks/PromoBannersBlock.vue'
import RichTextBlock from '~/components/template/blocks/RichTextBlock.vue'
import TrustBadgesBlock from '~/components/template/blocks/TrustBadgesBlock.vue'
import type { TemplateComponentKey } from '~/types/template'

export const templateRegistry: Record<TemplateComponentKey, Component> = {
  hero: HeroBlock,
  banner: BannerBlock,
  'product-grid': ProductGridBlock,
  'rich-text': RichTextBlock,
  cta: CtaBlock,
  'category-strip': CategoryStripBlock,
  'flash-sale': FlashSaleBlock,
  'brand-carousel': BrandCarouselBlock,
  'trust-badges': TrustBadgesBlock,
  'promo-banners': PromoBannersBlock,
}
