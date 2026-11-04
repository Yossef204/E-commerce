import { SetMetadata } from '@nestjs/common';

export const ALLOW_PENDING_ENTITY_KEY = 'allow_pending_entity';

/**
 * Decorator to explicitly allow access for sellers/companies whose entity is still
 * in PENDING_APPROVAL status (e.g. merchant onboarding, profile check, and KYC document uploads).
 */
export const AllowPendingEntity = () =>
  SetMetadata(ALLOW_PENDING_ENTITY_KEY, true);

