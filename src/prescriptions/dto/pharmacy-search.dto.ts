import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class PharmacySearchDto {
  @ApiProperty({
    example: 'K7M2X9QD',
    description: 'Retsept kodi yoki bemor telefon raqami',
  })
  @IsString()
  @MinLength(4)
  @MaxLength(30)
  q: string;
}
