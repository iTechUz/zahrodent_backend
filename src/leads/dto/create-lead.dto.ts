import { IsString, IsOptional, IsIn, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export const LEAD_STATUSES = [
  'new',
  'contacted',
  'consultation',
  'proposal',
  'converted',
  'cancelled',
] as const;

export class CreateLeadDto {
  @ApiProperty({ example: 'Ali Valiyev' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '+998901234567' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: 'Implantatsiya', required: false })
  @IsOptional()
  @IsString()
  service?: string;

  @ApiProperty({ example: 'Bot orqali kelgan xabar', required: false })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiProperty({ example: 'crm', required: false })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiProperty({
    example: 'Yaxshi mijoz, konsultatsiya kerak',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ enum: LEAD_STATUSES, required: false })
  @IsOptional()
  @IsIn(LEAD_STATUSES)
  status?: string;
}
