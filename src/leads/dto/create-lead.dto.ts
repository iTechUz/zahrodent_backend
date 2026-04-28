import { IsString, IsOptional, IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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

  @ApiProperty({ example: 'Yaxshi mijoz, konsultatsiya kerak', required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ enum: ['new', 'contacted', 'consultation', 'proposal', 'converted', 'cancelled'], required: false })
  @IsOptional()
  @IsEnum(['new', 'contacted', 'consultation', 'proposal', 'converted', 'cancelled'])
  status?: string;
}
