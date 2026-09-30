import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuthUserResponseDto {
  @ApiProperty({ example: 'u1' })
  id: string;

  @ApiProperty({ example: 'Dr. Zahro Admin' })
  name: string;

  @ApiProperty({ example: '+998901234567' })
  phone: string;

  @ApiProperty({ enum: ['admin', 'doctor', 'receptionist'] })
  role: string;

  @ApiPropertyOptional({ example: 'Umumiy stomatologiya' })
  specialty?: string;

  @ApiPropertyOptional()
  avatar?: string;

  @ApiPropertyOptional({
    description: 'Doctor yozuvi id si (faqat doctor roli uchun)',
  })
  doctorId?: string;
}

export class LoginResponseDto {
  @ApiProperty({ description: 'JWT access token (Bearer)' })
  access_token: string;

  @ApiProperty({
    description:
      'Refresh token (bir martalik, har /auth/refresh da yangisi beriladi). Maxfiy saqlang.',
  })
  refresh_token: string;

  @ApiProperty({
    description: 'Access token amal qilish muddati (soniya)',
    example: 900,
  })
  expires_in: number;

  @ApiProperty({ type: AuthUserResponseDto })
  user: AuthUserResponseDto;
}

export class MeResponseDto {
  @ApiProperty({ example: 'u1' })
  id: string;

  @ApiProperty({ example: 'Dr. Zahro Admin' })
  name: string;

  @ApiProperty({ example: '+998901234567' })
  phone: string;

  @ApiProperty({ enum: ['admin', 'doctor', 'receptionist'] })
  role: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Doctor yozuvi id si; boshqa rollar uchun null',
  })
  doctorId: string | null;
}

export class SuccessResponseDto {
  @ApiProperty({ example: true })
  success: true;
}
