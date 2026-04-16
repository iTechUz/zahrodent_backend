import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsArray, IsDateString, IsEnum, IsOptional, IsString } from 'class-validator'
import { NotificationType } from 'src/constantis'
import { IsCuid } from 'src/validator/cuid'
import { PaginationDto } from 'src/utils/paginations'

export class CreateNotificationDto {
  @ApiProperty({ enum: NotificationType })
  @IsEnum(NotificationType)
  type: NotificationType

  @ApiProperty({ example: 'cuid...' })
  @IsString()
  recipientId: string

  @ApiProperty({ example: 'Qabul eslatmasi: 15-iyun soat 10:00' })
  @IsString()
  message: string

  @ApiPropertyOptional({ example: '2025-06-14T18:00:00' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string
}

export class BulkNotificationDto {
  @ApiProperty({ enum: NotificationType })
  @IsEnum(NotificationType)
  type: NotificationType

  @ApiProperty({ example: ['cuid1', 'cuid2'] })
  @IsArray()
  @IsString({ each: true })
  recipientIds: string[]

  @ApiProperty({ example: 'Ertangi qabul soat 10:00 da bo\'ladi' })
  @IsString()
  message: string
}

export class BookingReminderDto {
  @ApiProperty({ example: 'cuid...' })
  @IsCuid()
  bookingId: string

  @ApiPropertyOptional({ example: 24, description: 'Brondan necha soat oldin' })
  @IsOptional()
  hoursBeforeAppointment?: number
}

export class NotificationFilterDto extends PaginationDto {
  @ApiPropertyOptional({ enum: NotificationType })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType

  @ApiPropertyOptional({ example: 'cuid...' })
  @IsOptional()
  @IsString()
  recipientId?: string
}
