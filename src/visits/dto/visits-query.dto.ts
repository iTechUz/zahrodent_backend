import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import {
  DateOnlyQuery,
  IdQuery,
  ListQueryDto,
} from '../../common/dto/pagination.dto';
import { VISIT_STATUSES } from './create-visit.dto';

export const VISIT_SORT_FIELDS = ['date', 'status', 'price'] as const;
export type VisitSortField = (typeof VISIT_SORT_FIELDS)[number];

export class VisitsQueryDto extends ListQueryDto {
  @ApiPropertyOptional()
  @IdQuery()
  patientId?: string;

  @ApiPropertyOptional({
    description: 'doctor roli uchun e’tiborsiz (doim o‘ziniki)',
  })
  @IdQuery()
  doctorId?: string;

  @ApiPropertyOptional({ enum: [...VISIT_STATUSES, 'all'] })
  @IsOptional()
  @IsIn([...VISIT_STATUSES, 'all'])
  status?: string;

  @ApiPropertyOptional({ example: '2026-09-01' })
  @DateOnlyQuery()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-09-30' })
  @DateOnlyQuery()
  endDate?: string;

  @ApiPropertyOptional({
    enum: VISIT_SORT_FIELDS,
    description: 'Standart: date desc',
  })
  @IsOptional()
  @IsIn(VISIT_SORT_FIELDS)
  sortBy?: VisitSortField;
}
