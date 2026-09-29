import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import {
  DATE_RANGES,
  DateOnlyQuery,
  DateRangeFilter,
  IdQuery,
  ListQueryDto,
} from '../../common/dto/pagination.dto';
import { BOOKING_SOURCES, BOOKING_STATUSES } from './create-booking.dto';

export const BOOKING_SORT_FIELDS = [
  'date',
  'time',
  'createdAt',
  'status',
  'source',
] as const;
export type BookingSortField = (typeof BOOKING_SORT_FIELDS)[number];

export class BookingsQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: [...BOOKING_STATUSES, 'all'] })
  @IsOptional()
  @IsIn([...BOOKING_STATUSES, 'all'])
  status?: string;

  @ApiPropertyOptional({ enum: [...BOOKING_SOURCES, 'all'] })
  @IsOptional()
  @IsIn([...BOOKING_SOURCES, 'all'])
  source?: string;

  @ApiPropertyOptional()
  @IdQuery()
  patientId?: string;

  @ApiPropertyOptional({
    description: 'Faqat admin/receptionist uchun; doctor doim o‘ziniki',
  })
  @IdQuery()
  doctorId?: string;

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
    enum: BOOKING_SORT_FIELDS,
    description: 'Standart: date desc, time desc',
  })
  @IsOptional()
  @IsIn(BOOKING_SORT_FIELDS)
  sortBy?: BookingSortField;
}
