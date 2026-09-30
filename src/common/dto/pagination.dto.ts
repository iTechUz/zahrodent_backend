import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { DATE_ONLY_REGEX } from '../utils/date.util';

export const MAX_PAGE_LIMIT = 100;
export const SORT_ORDERS = ['asc', 'desc'] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

export const DATE_RANGES = ['today', 'week', 'month', 'all'] as const;
export type DateRangeFilter = (typeof DATE_RANGES)[number];

export class PaginationQueryDto {
  @ApiPropertyOptional({
    minimum: 0,
    default: 0,
    description: '0 dan boshlanadi',
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  page?: number = 0;

  @ApiPropertyOptional({ minimum: 1, maximum: MAX_PAGE_LIMIT, default: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_LIMIT)
  @IsOptional()
  limit?: number = 10;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  search?: string;
}

/** Pagination + `order`; resource DTOs add a whitelisted `sortBy`. */
export class ListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: SORT_ORDERS,
    description:
      'Tartib yo‘nalishi. sortBy bo‘lmasa standart maydonga qo‘llanadi; sortBy bor, order yo‘q bo‘lsa — asc',
  })
  @IsOptional()
  @IsIn(SORT_ORDERS)
  order?: SortOrder;
}

/** Validator for optional `YYYY-MM-DD` query params. */
export function DateOnlyQuery(): PropertyDecorator {
  return (target, key) => {
    IsOptional()(target, key);
    IsString()(target, key);
    Matches(DATE_ONLY_REGEX, {
      message: `${String(key)} YYYY-MM-DD formatida bo‘lishi kerak`,
    })(target, key);
  };
}

/** Validator for optional id-like query params (cuid). */
export function IdQuery(): PropertyDecorator {
  return (target, key) => {
    IsOptional()(target, key);
    IsString()(target, key);
    MaxLength(64)(target, key);
  };
}

type OrderBy = Record<string, SortOrder>;

/**
 * Prisma `orderBy` from a whitelisted `sortBy` + `order`.
 * Neither given → `undefined` (callers keep the resource's existing default).
 * Only `order` → applied to `defaultField`. Only `sortBy` → ascending.
 * `id` is appended as a tie-breaker so pagination stays stable.
 */
export function buildOrderBy(
  query: { sortBy?: string; order?: SortOrder },
  defaultField: string,
): OrderBy[] | undefined {
  if (!query.sortBy && !query.order) return undefined;
  const field = query.sortBy ?? defaultField;
  const order = query.order ?? 'asc';
  return field === 'id' ? [{ id: order }] : [{ [field]: order }, { id: order }];
}

/** `{ orderBy }` for repository options, or `{}` when no sort requested. */
export function orderByOption<T>(
  query: { sortBy?: string; order?: SortOrder },
  defaultField: string,
): { orderBy?: T } {
  const orderBy = buildOrderBy(query, defaultField);
  return orderBy ? { orderBy: orderBy as unknown as T } : {};
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
}
