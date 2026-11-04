import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';

export const USER_ROLES = [
  'admin',
  'doctor',
  'receptionist',
  'pharmacist',
] as const;

export class CreateUserDto {
  @ApiProperty({ example: 'Shokir Xodjayev' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: '+998901234567' })
  @IsString()
  @Matches(/^\+998\d{9}$/, {
    message: "Telefon raqami noto'g'ri formatda (+998XXXXXXXXX)",
  })
  phone: string;

  @ApiProperty({ example: 'password123', description: 'Kamida 6 belgi' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'receptionist', enum: USER_ROLES })
  @IsIn(USER_ROLES, {
    message:
      "role faqat admin, doctor, receptionist yoki pharmacist bo'lishi mumkin",
  })
  role: (typeof USER_ROLES)[number];

  @ApiPropertyOptional({ example: 'Terapevt' })
  @IsOptional()
  @IsString()
  specialty?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatar?: string;
}
