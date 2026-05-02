export interface PaginationParams {
  page?: number | string;
  limit?: number | string;
}

export interface PaginationResult {
  skip: number;
  take: number;
  page: number;
  limit: number;
}

/**
 * Standardizes pagination logic across the application.
 * Follows KISS and DRY principles.
 */
export function getPagination(query: PaginationParams, defaultLimit = 10): PaginationResult {
  const page = Math.max(0, Number(query.page) || 0);
  const limit = Math.max(1, Number(query.limit) || defaultLimit);
  
  return {
    page,
    limit,
    skip: page * limit,
    take: limit,
  };
}
