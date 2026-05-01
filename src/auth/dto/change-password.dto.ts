import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ example: 'current_password_123' })
  @IsString()
  currentPassword: string;

  @ApiProperty({ example: 'new_password_456' })
  @IsString()
  @MinLength(6, { message: 'Yangi parol kamida 6 ta belgidan iborat bo\'lishi kerak' })
  newPassword: string;
}
