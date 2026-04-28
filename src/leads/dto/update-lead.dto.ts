import { IsString, IsOptional, IsEnum } from 'class-validator';

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
  @IsEnum(['new', 'contacted', 'consultation', 'proposal', 'converted', 'cancelled'])
  status?: string;
}
