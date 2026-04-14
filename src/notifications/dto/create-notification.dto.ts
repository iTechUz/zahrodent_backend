import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

const TYPES = ['sms', 'telegram'] as const;
const STATUSES = ['sent', 'delivered', 'failed'] as const;

export class CreateNotificationDto {
  @IsString()
  @MinLength(1)
  patientId: string;

  @IsIn(TYPES)
  type: (typeof TYPES)[number];

  @IsString()
  @MinLength(1)
  message: string;

  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];

  @IsOptional()
  @IsString()
  sentAt?: string;
}
