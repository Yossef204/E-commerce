export interface ReviewAuthor {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface Review {
  _id: string;
  productId: string;
  customerId: ReviewAuthor | string;
  orderId?: string;
  rating: number; // 1 to 5
  title?: string;
  comment?: string;
  isVerifiedPurchase: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewListResponse {
  reviews: Review[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateReviewPayload {
  productId: string;
  rating: number;
  title?: string;
  comment?: string;
}

export interface ReviewEligibilityResponse {
  eligible: boolean;
  orderId?: string;
}

