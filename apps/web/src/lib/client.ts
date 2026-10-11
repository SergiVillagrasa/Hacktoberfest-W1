import { ApiError, createApi } from './api';

export const api = createApi();

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.status === 404 && error.code === 'not_found' ? "We couldn't find that room. Check the code and try again." : error.message;
  return 'Something went wrong. Please try again.';
}
