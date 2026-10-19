import React from 'react';

export const FALLBACK_PRODUCT_IMAGE = '/images/fallback-placeholder.png';

export const PLACEHOLDER_SVG_DATA_URI =
  "data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22400%22%20height%3D%22400%22%20viewBox%3D%220%200%20400%20400%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20width%3D%22400%22%20height%3D%22400%22%20fill%3D%22%23f8fafc%22%2F%3E%3Crect%20x%3D%2220%22%20y%3D%2220%22%20width%3D%22360%22%20height%3D%22360%22%20rx%3D%2224%22%20fill%3D%22%23f1f5f9%22%20stroke%3D%22%23e2e8f0%22%20stroke-width%3D%222%22%2F%3E%3Cpath%20d%3D%22M155%20165c0-11%209-20%2020-20h50c11%200%2020%209%2020%2020v70c0%2011-9%2020-20%2020h-50c-11%200-20-9-20-20v-70z%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%226%22%2F%3E%3Ccircle%20cx%3D%22185%22%20cy%3D%22185%22%20r%3D%228%22%20fill%3D%22%2394a3b8%22%2F%3E%3Cpath%20d%3D%22M165%20235l25-25%2015%2015%2025-25%2015%2015%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%225%22%2F%3E%3Ctext%20x%3D%22200%22%20y%3D%22285%22%20font-family%3D%22sans-serif%22%20font-size%3D%2216%22%20font-weight%3D%22bold%22%20fill%3D%22%2364748b%22%20text-anchor%3D%22middle%22%3E%D8%B5%D9%88%D8%B1%D8%A9%20%D8%A7%D9%84%D9%85%D9%86%D8%AA%D8%AC%3C%2Ftext%3E%3C%2Fsvg%3E";

/**
 * Returns a clean, full URL for any image, handling objects, arrays, relative paths, and fallbacks.
 */
export const getImageUrl = (images: any): string => {
  if (!images) return FALLBACK_PRODUCT_IMAGE;

  const img = Array.isArray(images)
    ? images.length > 0
      ? images[0]
      : null
    : images;

  if (!img) return FALLBACK_PRODUCT_IMAGE;

  let urlStr = '';
  if (typeof img === 'string') {
    urlStr = img.trim();
  } else if (typeof img === 'object') {
    urlStr = (
      img.publicUrl ||
      img.url ||
      img.secure_url ||
      img.location ||
      img.path ||
      img.image ||
      img.key ||
      ''
    ).trim();
  }

  if (!urlStr) return FALLBACK_PRODUCT_IMAGE;

  // Full absolute URLs
  if (
    urlStr.startsWith('http://') ||
    urlStr.startsWith('https://') ||
    urlStr.startsWith('data:')
  ) {
    return urlStr;
  }

  // Relative public URLs
  if (urlStr.startsWith('/')) {
    return urlStr;
  }

  return `/${urlStr}`;
};

/**
 * Safe image onError handler to prevent broken image icons and infinite loops.
 */
export const handleImageError = (
  e: React.SyntheticEvent<HTMLImageElement, Event>,
) => {
  const target = e.currentTarget;
  target.onerror = null; // Prevent infinite fallback loops
  target.src = PLACEHOLDER_SVG_DATA_URI;
};

