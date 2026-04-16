import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator'
import { Gender, PatientSource } from 'src/constantis'
import { IsCuid } from 'src/validator/cuid'
import { PaginationDto } from 'src/utils/paginations'

export class PatientCreateDto {
  @ApiProperty({ example: 'Nodira', description: 'Bemor ismi' })
  @IsString()
  firstName: string

  @ApiPropertyOptional({ example: 'Karimova' })
  @IsOptional()
  @IsString()
  lastName?: string

  @ApiProperty({ example: '+998901234567' })
  @IsString()
  phone: string

  @ApiPropertyOptional({ example: 'Yunusobod tumani' })
  @IsOptional()
  @IsString()
  address?: string

  @ApiPropertyOptional({ example: '1990-05-20' })
  @IsOptional()
  @IsDateString()
  birthDate?: string

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender

  @ApiProperty({ enum: PatientSource, default: PatientSource.ADMIN })
  @IsOptional()
  @IsEnum(PatientSource)
  source?: PatientSource

  @ApiPropertyOptional({ example: 'Birinchi tashrif' })
  @IsOptional()
  @IsString()
  notes?: string

  @ApiPropertyOptional({ example: 'cuid...' })
  @IsOptional()
  @IsCuid()
  branchId?: string
}

export class PatientUpdateDto extends PartialType(PatientCreateDto) {}

export class PatientFilterDto extends PaginationDto {
  @ApiPropertyOptional({ enum: PatientSource })
  @IsOptional()
  @IsEnum(PatientSource)
  source?: PatientSource

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender

  @ApiPropertyOptional({ example: 'cuid...' })
  @IsOptional()
  @IsCuid()
  branchId?: string
}
