import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import { IsArray, IsDateString, IsOptional, IsString } from 'class-validator'
import { IsCuid } from 'src/validator/cuid'
import { PaginationDto } from 'src/utils/paginations'

export class CreateMedicalRecordDto {
  @ApiProperty({ example: 'cuid...' })
  @IsCuid()
  patientId: string

  @ApiProperty({ example: 'cuid...' })
  @IsCuid()
  doctorId: string

  @ApiPropertyOptional({ example: 'cuid...' })
  @IsOptional()
  @IsCuid()
  bookingId?: string

  @ApiProperty({ example: 'Tish kariesi (K02.1)' })
  @IsString()
  diagnosis: string

  @ApiPropertyOptional({ example: 'Plomba qo\'yildi, dorilar tavsiya qilindi' })
  @IsOptional()
  @IsString()
  treatmentNotes?: string

  @ApiProperty({ example: '2025-06-15T10:00:00' })
  @IsDateString()
  visitDate: string

  @ApiPropertyOptional({ example: ['xray.jpg', 'prescription.pdf'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[]
}

export class UpdateMedicalRecordDto extends PartialType(CreateMedicalRecordDto) {}

export class MedicalRecordFilterDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'cuid...' })
  @IsOptional()
  @IsCuid()
  patientId?: string

  @ApiPropertyOptional({ example: 'cuid...' })
  @IsOptional()
  @IsCuid()
  doctorId?: string

  @ApiPropertyOptional({ example: '2025-06-01' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string

  @ApiPropertyOptional({ example: '2025-06-30' })
  @IsOptional()
  @IsDateString()
  dateTo?: string
}
