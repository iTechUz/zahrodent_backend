import {
  IsString,
  IsOptional,
  IsIn,
  IsNotEmpty,
  Matches,
} from 'class-validator';
import { LEAD_PHONE_REGEX, LEAD_STATUSES } from './create-lead.dto';

export class UpdateLeadDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(LEAD_PHONE_REGEX, { message: 'Invalid phone' })
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
