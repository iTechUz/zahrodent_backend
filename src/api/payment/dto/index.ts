import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import { IsDateString, IsEnum, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator'
import { PaymentMethod, PaymentStatus } from 'src/constantis'
import { IsCuid } from 'src/validator/cuid'
import { PaginationDto } from 'src/utils/paginations'

export class CreatePaymentDto {
  @ApiProperty({ example: 'cuid...' })
  @IsCuid()
  patientId: string

  @ApiPropertyOptional({ example: 'cuid...' })
  @IsOptional()
  @IsCuid()
  bookingId?: string

  @ApiProperty({ example: 350000, description: 'Asl summa' })
  @IsNumber()
  @IsPositive()
  amount: number

  @ApiPropertyOptional({ example: 50000, description: 'Chegirma' })
  @IsOptional()
  @IsNumber()
  discount?: number

  @ApiProperty({ example: 300000, description: 'To\'lov summasi' })
  @IsNumber()
  @IsPositive()
  totalAmount: number

  @ApiProperty({ enum: PaymentMethod, default: PaymentMethod.CASH })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod

  @ApiPropertyOptional({ example: 'Tish oqartirish xizmati' })
  @IsOptional()
  @IsString()
  description?: string
}

export class UpdatePaymentDto extends PartialType(CreatePaymentDto) {}

export class PaymentFilterDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'cuid...' })
  @IsOptional()
  @IsCuid()
  patientId?: string

  @ApiPropertyOptional({ example: 'cuid...' })
  @IsOptional()
  @IsCuid()
  bookingId?: string

  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus

  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod

  @ApiPropertyOptional({ example: '2025-06-01' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string

  @ApiPropertyOptional({ example: '2025-06-30' })
  @IsOptional()
  @IsDateString()
  dateTo?: string
}
