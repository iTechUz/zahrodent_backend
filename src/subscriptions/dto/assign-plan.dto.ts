import { IsString, IsEnum, IsOptional, IsDateString } from 'class-validator';
import { SubscriptionStatus } from '@prisma/client';

export class AssignPlanDto {
  @IsString()
  branchId: string;

  @IsString()
  planId: string;

  @IsEnum(SubscriptionStatus)
  @IsOptional()
  status?: SubscriptionStatus;

  @IsDateString()
  @IsOptional()
  endDate?: string;
}
