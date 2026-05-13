export const DEFAULT_GYM_IMAGE =
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=900&q=80';

export const DEFAULT_WELLNESS_PARTNER_IMAGE =
  'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=900&q=80';

export const DEFAULT_WELLNESS_SERVICE_IMAGE =
  'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?w=900&q=80';

export const DEFAULT_HOMEPAGE_HERO_IMAGE =
  'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1200&q=80';

export const DEFAULT_PRODUCT_IMAGE =
  'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=900&q=80';

function cleanImage(value: any): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : '';
}

export function firstImage(...values: any[]): string {
  for (const value of values) {
    if (Array.isArray(value)) {
      const nested = firstImage(...value);
      if (nested) return nested;
      continue;
    }

    const image = cleanImage(value);
    if (image) return image;
  }

  return '';
}

export function productImage(product: any): string {
  return firstImage(
    product?.images,
    product?.imageUrl,
    product?.image,
    product?.img,
    product?.thumbnailUrl,
    product?.coverImage,
  ) || DEFAULT_PRODUCT_IMAGE;
}

export function wellnessPartnerImage(partner: any): string {
  return firstImage(partner?.photos, partner?.coverPhoto, partner?.coverImage, partner?.imageUrl) || DEFAULT_WELLNESS_PARTNER_IMAGE;
}

export function wellnessServiceImage(service: any): string {
  return firstImage(
    service?.imageUrl,
    service?.image,
    service?.images,
    service?.partner?.photos,
    service?.partner?.coverPhoto,
    service?.partner?.coverImage,
    service?.partner?.imageUrl,
  ) || DEFAULT_WELLNESS_SERVICE_IMAGE;
}
