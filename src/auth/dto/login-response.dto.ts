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
}

export class LoginResponseDto {
  @ApiProperty({ description: 'JWT access token' })
  access_token: string;

  @ApiProperty({ type: AuthUserResponseDto })
  user: AuthUserResponseDto;
}
