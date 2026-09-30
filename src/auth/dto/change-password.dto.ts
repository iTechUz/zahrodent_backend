import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'old-password' })
  @IsString()
  @MinLength(1, { message: 'Joriy parol majburiy' })
  @MaxLength(72)
  currentPassword: string;

  // bcrypt only uses the first 72 bytes → longer passwords are rejected.
  @ApiProperty({ minLength: 8, maxLength: 72, example: 'new-strong-pass' })
  @IsString()
  @MinLength(8, {
    message: "Yangi parol kamida 8 belgidan iborat bo'lishi kerak",
  })
  @MaxLength(72, { message: 'Yangi parol 72 belgidan oshmasligi kerak' })
  newPassword: string;
}
