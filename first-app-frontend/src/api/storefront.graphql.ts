import { gql } from '@apollo/client';

export const GET_STOREFRONT_DATA = gql`
  query GetStorefrontData($filter: CatalogFilterInput) {
    getStorefrontCategories {
      id
      name
    }
    getStorefrontProducts(filter: $filter) {
      items {
        id
        name
        title
        description
        price
        stock
        images
        brandName
        sellingEntityId
        category {
          id
          name
        }
      }
      total
      page
      totalPages
    }
  }
`;

export const GET_PRODUCT_DETAILS = gql`
  query GetProductDetails($id: ID!) {
    getProductDetails(id: $id) {
      id
      name
      title
      slug
      description
      price
      stock
      images
      brandName
      sellingEntityId
      category {
        id
        name
        slug
        description
        image
      }
      brand {
        id
        name
        slug
      }
      variants {
        sku
        price
        availableStock
        initialStock
        isActive
      }
      createdAt
      updatedAt
    }
  }
`;

export interface StorefrontCategory {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  image?: string;
}

export interface StorefrontProductVariant {
  sku: string;
  price: number;
  availableStock?: number;
  initialStock?: number;
  isActive?: boolean;
}

export interface StorefrontProduct {
  id: string;
  name: string;
  title?: string;
  slug?: string;
  description: string;
  price: number;
  stock: number;
  images: string[];
  brandName?: string;
  sellingEntityId?: string;
  category?: {
    id: string;
    name: string;
    slug?: string;
    description?: string;
    image?: string;
  };
  brand?: {
    id: string;
    name: string;
    slug?: string;
  };
  variants?: StorefrontProductVariant[];
  createdAt?: string;
  updatedAt?: string;
}

export interface StorefrontProductsData {
  items: StorefrontProduct[];
  total: number;
  page: number;
  totalPages: number;
}

export interface GetStorefrontDataResponse {
  getStorefrontCategories: StorefrontCategory[];
  getStorefrontProducts: StorefrontProductsData;
}

export interface GetProductDetailsResponse {
  getProductDetails: StorefrontProduct;
}

export interface CatalogFilterInput {
  search?: string;
  categoryId?: string;
  brandId?: string;
  sortBy?: string;
  sortOrder?: string;
  page?: number;
  limit?: number;
}
