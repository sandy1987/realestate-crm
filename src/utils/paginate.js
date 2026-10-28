/**
 * src/utils/paginate.js
 *
 * Pagination query parser and metadata builders.
 *
 * Enforces server-side constraints:
 *  - Default page: 1
 *  - Default limit: 20
 *  - Max limit: 100 (never allows unbounded or abusive limit requests)
 *  - Sort order: 'asc' or 'desc' (default: 'desc')
 *  - Sort by: whitelist validation against allowedSortFields
 */

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DEFAULT_SORT_BY = 'createdAt';
const DEFAULT_SORT_ORDER = 'desc';

/**
 * Parses and sanitizes pagination query parameters from Express `req.query`.
 *
 * @param {Record<string, unknown>} query - typically req.query
 * @param {string[]} [allowedSortFields=['createdAt']] - whitelist of valid sort field names
 * @returns {{
 *   page: number,
 *   limit: number,
 *   skip: number,
 *   sortBy: string,
 *   sortOrder: 'asc' | 'desc'
 * }}
 */
export function parsePagination(query = {}, allowedSortFields = [DEFAULT_SORT_BY]) {
  // Page
  let page = parseInt(String(query.page), 10);
  if (Number.isNaN(page) || page < 1) {
    page = DEFAULT_PAGE;
  }

  // Limit
  let limit = parseInt(String(query.limit), 10);
  if (Number.isNaN(limit) || limit < 1) {
    limit = DEFAULT_LIMIT;
  } else if (limit > MAX_LIMIT) {
    limit = MAX_LIMIT;
  }

  // Skip
  const skip = (page - 1) * limit;

  // SortBy
  let sortBy = DEFAULT_SORT_BY;
  if (typeof query.sortBy === 'string' && allowedSortFields.includes(query.sortBy)) {
    sortBy = query.sortBy;
  } else if (allowedSortFields.length > 0) {
    sortBy = allowedSortFields[0];
  }

  // SortOrder
  let sortOrder = DEFAULT_SORT_ORDER;
  if (typeof query.sortOrder === 'string') {
    const normalized = query.sortOrder.toLowerCase();
    if (normalized === 'asc' || normalized === 'desc') {
      sortOrder = normalized;
    }
  }

  return {
    page,
    limit,
    skip,
    sortBy,
    sortOrder,
  };
}

/**
 * Builds standard pagination metadata object.
 *
 * @param {number} total - total document count
 * @param {number} page - current page
 * @param {number} limit - page size limit
 * @returns {{ page: number, limit: number, total: number, totalPages: number }}
 */
export function buildPaginationMeta(total, page, limit) {
  const safeTotal = Math.max(0, parseInt(String(total), 10) || 0);
  const safeLimit = Math.max(1, parseInt(String(limit), 10) || DEFAULT_LIMIT);
  const safePage = Math.max(1, parseInt(String(page), 10) || DEFAULT_PAGE);
  const totalPages = Math.max(1, Math.ceil(safeTotal / safeLimit));

  return {
    page: safePage,
    limit: safeLimit,
    total: safeTotal,
    totalPages,
  };
}
