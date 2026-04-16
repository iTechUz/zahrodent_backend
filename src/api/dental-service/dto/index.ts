import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import { IsBoolean, IsInt, IsNumber, IsOptional, IsPositive, IsString, Min } from 'class-validator'
import { Transform } from 'class-transformer'
import { IsCuid } from 'src/validator/cuid'
import { PaginationDto } from 'src/utils/paginations'

export class CreateServiceDto {
  @ApiProperty({ example: 'Tish oqartirish' })
  @IsString()
  name: string

  @ApiProperty({ example: 350000, description: 'Narx (so\'mda)' })
  @IsNumber()
  @IsPositive()
  price: number

  @ApiPropertyOptional({ example: 'Professional bleaching' })
  @IsOptional()
  @IsString()
  description?: string

  @ApiPropertyOptional({ example: 60, description: 'Davomiyligi (daqiqada)' })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  duration?: number

  @ApiPropertyOptional({ example: 'cuid...' })
  @IsOptional()
  @IsCuid()
  branchId?: string
}

export class UpdateServiceDto extends PartialType(CreateServiceDto) {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}

export class ServiceFilterDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'cuid...' })
  @IsOptional()
  @IsCuid()
  branchId?: string

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isActive?: boolean
}
