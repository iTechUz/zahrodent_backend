import { IsString, IsOptional, IsIn } from 'class-validator';
import { LEAD_STATUSES } from './create-lead.dto';

export class UpdateLeadDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  service?: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsIn(LEAD_STATUSES)
  status?: string;
}
