export const SEED_SCOPE = 'catalog-flow-v2';
export const SEED_NOTE_PREFIX = `[seed:${SEED_SCOPE}]`;
export const SEED_REASON_PREFIX = `[seed:${SEED_SCOPE}]`;

export function resolveSeedUserEmails() {
  return [
    process.env.SEED_SUPER_ADMIN_EMAIL ?? 'superadmin@local.dev',
    'superadmin2@local.dev',
    process.env.SEED_ADMIN_EMAIL ?? 'admin@local.dev',
    'admin2@local.dev',
    'admin3@local.dev',
    'boss@local.dev',
    'marketing@local.dev',
    'sales@local.dev',
    'customer1@local.dev',
    'customer2@local.dev',
    'customer3@local.dev',
  ];
}

export const SEED_SIZE_ABBREVIATIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
export const SEED_COLOR_NAMES = ['Black', 'White', 'Red', 'Blue', 'Green', 'Yellow', 'Gray', 'Navy'];

export const SEED_TAG_SLUGS = ['nuevo', 'destacado', 'outdoor', 'cafe-especialidad'];
export const SEED_COUPON_CODES = ['WELCOME10', 'BULK15'];

export const SEED_CATEGORY_SLUGS = [
  'polos-premium',
  'termos-termicos',
  'cafe-especialidad',
  'indumentaria',
  'hidratacion',
  'alimentos',
];

export const SEED_PRODUCT_SKUS = ['APP-POLO-PIMA', 'HOME-TERMO-750', 'FOOD-CAFE-GEISHA-1KG'];

export const SEED_VARIANT_SKUS = [
  'APP-POLO-PIMA-BLK-M',
  'APP-POLO-PIMA-BLK-L',
  'APP-POLO-PIMA-WHT-M',
];