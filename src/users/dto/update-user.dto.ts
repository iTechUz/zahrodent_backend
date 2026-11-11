import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional({
    description:
      'false → xodim faolsizlantiriladi (kira olmaydi, sessiyalari tugaydi)',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
