import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator'
import { BookingSource, BookingStatus } from 'src/constantis'
import { IsCuid } from 'src/validator/cuid'
import { PaginationDto } from 'src/utils/paginations'

export class CreateBookingDto {
  @ApiProperty({ example: 'cuid...' })
  @IsCuid()
  patientId: string

  @ApiProperty({ example: 'cuid...' })
  @IsCuid()
  doctorId: string

  @ApiProperty({ example: 'cuid...' })
  @IsCuid()
  branchId: string

  @ApiPropertyOptional({ example: 'cuid...' })
  @IsOptional()
  @IsCuid()
  serviceId?: string

  @ApiProperty({ example: '2025-06-15' })
  @IsDateString()
  date: string

  @ApiProperty({ example: '10:00' })
  @IsString()
  startTime: string

  @ApiPropertyOptional({ example: '10:30' })
  @IsOptional()
  @IsString()
  endTime?: string

  @ApiProperty({ enum: BookingSource, default: BookingSource.ADMIN })
  @IsOptional()
  @IsEnum(BookingSource)
  source?: BookingSource

  @ApiPropertyOptional({ example: 'Tish og\'rig\'i bor' })
  @IsOptional()
  @IsString()
  notes?: string
}

export class UpdateBookingDto extends PartialType(CreateBookingDto) {}

export class CancelBookingDto {
  @ApiPropertyOptional({ example: 'Mijoz qatnasha olmadi' })
  @IsOptional()
  @IsString()
  cancelReason?: string
}

export class BookingFilterDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'cuid...' })
  @IsOptional()
  @IsCuid()
  doctorId?: string

  @ApiPropertyOptional({ example: 'cuid...' })
  @IsOptional()
  @IsCuid()
  patientId?: string

  @ApiPropertyOptional({ example: 'cuid...' })
  @IsOptional()
  @IsCuid()
  branchId?: string

  @ApiPropertyOptional({ enum: BookingStatus })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus

  @ApiPropertyOptional({ enum: BookingSource })
  @IsOptional()
  @IsEnum(BookingSource)
  source?: BookingSource

  @ApiPropertyOptional({ example: '2025-06-01' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string

  @ApiPropertyOptional({ example: '2025-06-30' })
  @IsOptional()
  @IsDateString()
  dateTo?: string
}

export class AvailableSlotsDto {
  @ApiProperty({ example: 'cuid...' })
  @IsCuid()
  doctorId: string

  @ApiProperty({ example: 'cuid...' })
  @IsCuid()
  branchId: string

  @ApiProperty({ example: '2025-06-15' })
  @IsDateString()
  date: string
}
