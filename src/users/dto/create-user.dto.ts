import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'Shokir Xodjayev' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'shokir@zahro.dental' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', description: 'Kamida 6 belgi' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'receptionist', enum: ['admin', 'doctor', 'receptionist'] })
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
