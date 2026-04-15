import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsISO8601, IsString, MinLength } from 'class-validator';

export class RecipientQueryDto {
  @ApiProperty({ example: '2024-04-16T00:00:00Z' })
  @IsISO8601()
  startDate: string;

  @ApiProperty({ example: '2024-04-16T23:59:59Z' })
  @IsISO8601()
  endDate: string;
}

export class BulkSendDto {
  @ApiProperty({ example: ['cuid1', 'cuid2'], description: 'Bemorlar ID ro\'yxati' })
  @IsArray()
  @IsString({ each: true })
  patientIds: string[];

  @ApiProperty({ example: 'Eslatma: Qabulingiz ertaga soat 10:00da.' })
  @IsString()
  @MinLength(5)
  message: string;
}
