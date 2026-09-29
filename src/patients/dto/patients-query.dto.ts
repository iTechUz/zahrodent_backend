import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import {
  DateOnlyQuery,
  IdQuery,
  ListQueryDto,
} from '../../common/dto/pagination.dto';
import { PATIENT_SOURCES } from './create-patient.dto';

export const PATIENT_SORT_FIELDS = [
  'createdAt',
  'firstName',
  'lastName',
  'age',
  'source',
] as const;
export type PatientSortField = (typeof PATIENT_SORT_FIELDS)[number];

export class PatientsQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: [...PATIENT_SOURCES, 'all'] })
  @IsOptional()
  @IsIn([...PATIENT_SOURCES, 'all'])
  source?: string;

  @ApiPropertyOptional({
    example: '2026-09-01',
    description: 'created_at >= (Asia/Tashkent kun)',
  })
  @DateOnlyQuery()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-09-30',
    description: 'created_at <= (kun oxirigacha)',
  })
  @DateOnlyQuery()
  endDate?: string;

  @ApiPropertyOptional({
    enum: ['true', 'false'],
    description: 'Faqat qarzdorlar (balance < 0)',
  })
  @IsOptional()
  @IsIn(['true', 'false'])
  debtOnly?: 'true' | 'false';

  @ApiPropertyOptional({ description: 'Biriktirilgan shifokor' })
  @IdQuery()
  doctorId?: string;

  @ApiPropertyOptional({
    enum: PATIENT_SORT_FIELDS,
    description: 'Standart: createdAt desc',
  })
  @IsOptional()
  @IsIn(PATIENT_SORT_FIELDS)
  sortBy?: PatientSortField;
}
