import apiClient from './client';
import type {
  Review,
  ReviewListResponse,
  CreateReviewPayload,
  ReviewEligibilityResponse,
} from '../types/review';

export const reviewApi = {
  // Customer submits verified review
  async createReview(payload: CreateReviewPayload): Promise<Review> {
    const res = await apiClient.post<Review>('/reviews', payload);
    return res.data;
  },

  // Check if current user is eligible to review
  async checkEligibility(productId: string): Promise<ReviewEligibilityResponse> {
    const res = await apiClient.get<ReviewEligibilityResponse>(
      `/reviews/eligibility/${productId}`
    );
    return res.data;
  },

  // Fetch paginated product reviews
  async getProductReviews(
    productId: string,
    params?: { page?: number; limit?: number }
  ): Promise<ReviewListResponse> {
    const res = await apiClient.get<ReviewListResponse>(
      `/reviews/product/${productId}`,
      { params }
    );
    return res.data;
  },
};

export default reviewApi;

