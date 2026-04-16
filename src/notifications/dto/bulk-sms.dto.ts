import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsISO8601, IsString, MinLength, IsOptional } from 'class-validator';

export class RecipientQueryDto {
  @ApiProperty({ example: '2024-04-16T00:00:00Z' })
  @IsISO8601()
  @IsOptional()
  startDate?: string;

  @ApiProperty({ example: '2024-04-16T23:59:59Z' })
  @IsISO8601()
  @IsOptional()
  endDate?: string;

  @ApiProperty({ example: 'patient', enum: ['patient', 'doctor'] })
  @IsString()
  @IsOptional()
  targetType?: 'patient' | 'doctor';
}

export class BulkSendDto {
  @ApiProperty({
    example: ['cuid1', 'cuid2'],
    description: "Qabul qiluvchilar ID ro'yxati",
  })
  @IsArray()
  @IsString({ each: true })
  targetIds: string[];

  @ApiProperty({ example: 'patient', enum: ['patient', 'doctor'] })
  @IsString()
  targetType: 'patient' | 'doctor';

  @ApiProperty({ example: 'Eslatma: Qabulingiz ertaga soat 10:00da.' })
  @IsString()
  @MinLength(5)
  message: string;
}
