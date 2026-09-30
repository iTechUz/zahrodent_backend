import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsString,
  MaxLength,
  MinLength,
  IsOptional,
} from 'class-validator';

const TARGET_TYPES = ['patient', 'doctor'] as const;

export class RecipientQueryDto {
  @ApiProperty({ example: '2024-04-16T00:00:00Z' })
  @IsISO8601()
  @IsOptional()
  startDate?: string;

  @ApiProperty({ example: '2024-04-16T23:59:59Z' })
  @IsISO8601()
  @IsOptional()
  endDate?: string;

  @ApiProperty({ example: 'patient', enum: TARGET_TYPES, required: false })
  @IsIn(TARGET_TYPES)
  @IsOptional()
  targetType?: 'patient' | 'doctor';
}

export class BulkSendDto {
  @ApiProperty({
    example: ['cuid1', 'cuid2'],
    description: "Qabul qiluvchilar ID ro'yxati",
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  targetIds: string[];

  @ApiProperty({ example: 'patient', enum: TARGET_TYPES })
  @IsIn(TARGET_TYPES)
  targetType: 'patient' | 'doctor';

  @ApiProperty({ example: 'Eslatma: Qabulingiz ertaga soat 10:00da.' })
  @IsString()
  @MinLength(5)
  @MaxLength(918) // Eskiz: 6 × 153-belgili SMS bo'lagi
  message: string;
}
