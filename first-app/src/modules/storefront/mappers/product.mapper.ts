import { ProductType } from '../types/product.type';

export function normalizeImageUrl(img: any): string | null {
  if (!img) return null;
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
      img.key ||
      ''
    ).trim();
  }
  if (!urlStr) return null;
  if (
    urlStr.startsWith('http://') ||
    urlStr.startsWith('https://') ||
    urlStr.startsWith('//') ||
    urlStr.startsWith('data:')
  ) {
    if (urlStr.startsWith('//')) {
      return `https:${urlStr}`;
    }
    return urlStr;
  }
  const s3Bucket = process.env.S3_BUCKET_NAME || process.env.S3_BUCKET || 'ym-social-app';
  const s3Region = process.env.S3_REGION || 'us-east-1';
  const cleaned = urlStr.replace(/^\/+/, '');
  if (cleaned.startsWith('uploads/')) {
    const baseUrl =
      process.env.BACKEND_URL ||
      process.env.BASE_URL ||
      'http://localhost:3000';
    return `${baseUrl}/${cleaned}`;
  }
  return `https://${s3Bucket}.s3.${s3Region}.amazonaws.com/${cleaned}`;
}

export class ProductMapper {
  static toGraphQL(doc: any): ProductType {
    const product = doc?.toObject ? doc.toObject() : doc;
    const variantImages: any[] = [];
    if (Array.isArray(product.variants)) {
      for (const v of product.variants) {
        if (Array.isArray(v.images)) {
          variantImages.push(...v.images);
        } else if (v.image) {
          variantImages.push(v.image);
        }
      }
    }

    const rawImages: any[] = [
      product.image,
      ...(Array.isArray(product.subImages) ? product.subImages : []),
      ...(Array.isArray(product.images) ? product.images : []),
      ...variantImages,
    ];

    const images: string[] = rawImages
      .map(normalizeImageUrl)
      .filter((u): u is string => Boolean(u));

    const firstVariant = Array.isArray(product.variants) && product.variants.length > 0
      ? product.variants[0]
      : null;

    const brandName =
      (typeof product.brandId === 'object' && product.brandId?.name)
        ? product.brandId.name
        : (product.brandName || '');

    return {
      id: product._id?.toString() || '',
      name: product.title || '',
      title: product.title || '',
      slug: product.slug || '',
      description: product.desc || product.description || '',
      price: Number(firstVariant?.price ?? 0),
      stock: Number(
        product.stock ??
          product.availableStock ??
          product.quantity ??
          product.inventory ??
          firstVariant?.availableStock ??
          firstVariant?.initialStock ??
          firstVariant?.stock ??
          0,
      ),
      images: images.length > 0 ? images : (product.images || []),
      brandName,
      categoryId: product.categoryId?._id?.toString() || product.categoryId?.toString() || undefined,
      brandId: product.brandId?._id?.toString() || product.brandId?.toString() || undefined,
      sellingEntityId: product.sellingEntityId?._id?.toString() || product.sellingEntityId?.toString() || undefined,
      variants: Array.isArray(product.variants)
        ? product.variants.map((v: any) => ({
            sku: v.sku || '',
            price: Number(v.price || 0),
            initialStock: Number(v.initialStock || 0),
            availableStock: v.availableStock !== undefined ? Number(v.availableStock) : undefined,
            isActive: v.isActive !== false,
          }))
        : [],
      createdAt: product.createdAt?.toISOString?.() || (product.createdAt ? String(product.createdAt) : undefined),
      updatedAt: product.updatedAt?.toISOString?.() || (product.updatedAt ? String(product.updatedAt) : undefined),
    };
  }
}
