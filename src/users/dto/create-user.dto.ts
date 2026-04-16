import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength, Matches } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'Shokir Xodjayev' })
  @IsString()
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

  @ApiProperty({
    example: 'receptionist',
    enum: ['admin', 'doctor', 'receptionist'],
  })
  @IsString()
  role: string;

  @ApiPropertyOptional({ example: 'Terapevt' })
  @IsOptional()
  @IsString()
  specialty?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatar?: string;
}
