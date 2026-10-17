import type { Paginated } from "@aninusa/types";

export function pageToSkip(page: number, perPage: number): number {
  return Math.max(0, (page - 1) * perPage);
}

export function buildPagination<T>(
  items: T[],
  page: number,
  perPage: number,
  total: number,
): Paginated<T> {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  return {
    items,
    page,
    perPage,
    total,
    totalPages,
    hasNext: page < totalPages,
  };
}
