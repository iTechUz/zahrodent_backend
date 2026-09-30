import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ListQueryDto } from '../../common/dto/pagination.dto';

export const DOCTOR_SORT_FIELDS = [
  'firstName',
  'lastName',
  'specialty',
] as const;
export type DoctorSortField = (typeof DOCTOR_SORT_FIELDS)[number];

export class DoctorsQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ description: "Mutaxassislik yoki 'all'" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  specialty?: string;

  @ApiPropertyOptional({
    enum: DOCTOR_SORT_FIELDS,
    description: 'Standart: firstName asc',
  })
  @IsOptional()
  @IsIn(DOCTOR_SORT_FIELDS)
  sortBy?: DoctorSortField;
}
