import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { ListQueryDto } from '../../common/dto/pagination.dto';

export const PRESCRIPTION_STATUSES = [
  'issued',
  'dispensed',
  'cancelled',
] as const;

export class PrescriptionsQueryDto extends ListQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  patientId?: string;

  @ApiPropertyOptional({ enum: [...PRESCRIPTION_STATUSES, 'all'] })
  @IsOptional()
  @IsIn([...PRESCRIPTION_STATUSES, 'all'])
  status?: string;
}
