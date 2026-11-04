import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CreateBookingDto } from './create-booking.dto';

export class UpdateBookingDto extends PartialType(CreateBookingDto) {
  /** Shown to the patient when the status becomes "cancelled"; kept in the status log. */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  statusReason?: string;
}
