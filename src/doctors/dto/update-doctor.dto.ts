import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateDoctorDto } from './create-doctor.dto';

export class UpdateDoctorDto extends PartialType(CreateDoctorDto) {
  /** false → shifokor faolsizlantiriladi (login ham), true → qayta yoqiladi. */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
