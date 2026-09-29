import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import {
  DATE_RANGES,
  DateOnlyQuery,
  DateRangeFilter,
  IdQuery,
  ListQueryDto,
} from '../../common/dto/pagination.dto';
import {
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  PAYMENT_TYPES,
} from './create-payment.dto';

export const PAYMENT_SORT_FIELDS = [
  'date',
  'amount',
  'status',
  'method',
  'type',
] as const;
export type PaymentSortField = (typeof PAYMENT_SORT_FIELDS)[number];

export class PaymentsQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: [...PAYMENT_STATUSES, 'all'] })
  @IsOptional()
  @IsIn([...PAYMENT_STATUSES, 'all'])
  status?: string;

  @ApiPropertyOptional({ enum: [...PAYMENT_METHODS, 'all'] })
  @IsOptional()
  @IsIn([...PAYMENT_METHODS, 'all'])
  method?: string;

  @ApiPropertyOptional({ enum: [...PAYMENT_TYPES, 'all'] })
  @IsOptional()
  @IsIn([...PAYMENT_TYPES, 'all'])
  type?: string;

  @ApiPropertyOptional()
  @IdQuery()
  patientId?: string;

  @ApiPropertyOptional({ enum: DATE_RANGES, default: 'all' })
  @IsOptional()
  @IsIn(DATE_RANGES)
  dateRange?: DateRangeFilter;

  @ApiPropertyOptional({
    example: '2026-09-01',
    description: 'dateRange dan ustun',
  })
  @DateOnlyQuery()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-09-30' })
  @DateOnlyQuery()
  endDate?: string;

  @ApiPropertyOptional({
    enum: PAYMENT_SORT_FIELDS,
    description: 'Standart: date desc',
  })
  @IsOptional()
  @IsIn(PAYMENT_SORT_FIELDS)
  sortBy?: PaymentSortField;
}
