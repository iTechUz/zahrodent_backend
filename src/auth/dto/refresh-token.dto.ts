import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Login/refresh javobidagi refresh_token',
    example: 'q1w2e3...base64url',
  })
  @IsString()
  @MinLength(1, { message: 'refresh_token majburiy' })
  @MaxLength(512)
  refresh_token: string;
}
