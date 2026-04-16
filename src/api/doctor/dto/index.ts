import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'
import { Transform } from 'class-transformer'
import { IsCuid } from 'src/validator/cuid'
import { PaginationDto } from 'src/utils/paginations'

export class CreateScheduleDto {
  @ApiProperty({ example: 'cuid...' })
  @IsCuid()
  branchId: string

  @ApiProperty({ example: 1, description: '0=Yakshanba, 1=Dushanba, ... 6=Shanba' })
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number

  @ApiProperty({ example: '09:00' })
  @IsString()
  startTime: string

  @ApiProperty({ example: '18:00' })
  @IsString()
  endTime: string

  @ApiPropertyOptional({ example: 30, description: 'Slot davomiyligi (daqiqada)' })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(10)
  slotDuration?: number

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean
}

export class UpdateScheduleDto extends PartialType(CreateScheduleDto) {}

export class DoctorFilterDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'cuid...' })
  @IsOptional()
  @IsCuid()
  branchId?: string
}
