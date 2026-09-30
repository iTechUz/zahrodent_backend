import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { SORT_ORDERS, SortOrder } from '../../common/dto/pagination.dto';

export const USER_SORT_FIELDS = ['createdAt', 'name', 'role', 'phone'] as const;
export type UserSortField = (typeof USER_SORT_FIELDS)[number];

/** GET /users returns a plain array (no pagination) — only sorting. */
export class UsersQueryDto {
  @ApiPropertyOptional({
    enum: USER_SORT_FIELDS,
    description: 'Standart: createdAt desc',
  })
  @IsOptional()
  @IsIn(USER_SORT_FIELDS)
  sortBy?: UserSortField;

  @ApiPropertyOptional({ enum: SORT_ORDERS })
  @IsOptional()
  @IsIn(SORT_ORDERS)
  order?: SortOrder;
}
