import { SetMetadata } from '@nestjs/common';

// Mark a route as public (no JWT required).
// The JwtAuthGuard checks for this metadata — if present, skips authentication.
// Usage: @Public() before a controller method.
// Similar to Angular's route data: { public: true }
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
