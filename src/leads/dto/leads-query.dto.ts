import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { DateOnlyQuery, ListQueryDto } from '../../common/dto/pagination.dto';
import { LEAD_STATUSES } from './create-lead.dto';

export const LEAD_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'name',
  'status',
  'source',
] as const;
export type LeadSortField = (typeof LEAD_SORT_FIELDS)[number];

export class LeadsQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: [...LEAD_STATUSES, 'all'] })
  @IsOptional()
  @IsIn([...LEAD_STATUSES, 'all'])
  status?: string;

  @ApiPropertyOptional({ example: 'telegram_bot' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  source?: string;

  @ApiPropertyOptional({
    example: '2026-09-01',
    description: 'created_at >= 00:00 Asia/Tashkent',
  })
  @DateOnlyQuery()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-09-30',
    description: 'created_at <= 23:59:59.999 Asia/Tashkent',
  })
  @DateOnlyQuery()
  endDate?: string;

  @ApiPropertyOptional({
    enum: LEAD_SORT_FIELDS,
    description: 'Standart: createdAt desc',
  })
  @IsOptional()
  @IsIn(LEAD_SORT_FIELDS)
  sortBy?: LeadSortField;
}
