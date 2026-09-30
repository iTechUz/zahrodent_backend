import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export class PatientFindOneQueryDto {
  @ApiPropertyOptional({
    enum: ['true', 'false'],
    description:
      "true — o'chirilgan (soft delete) bemorni ham qaytaradi (faqat admin; boshqa rollar uchun e'tiborsiz)",
  })
  @IsOptional()
  @IsIn(['true', 'false'])
  includeDeleted?: 'true' | 'false';
}
