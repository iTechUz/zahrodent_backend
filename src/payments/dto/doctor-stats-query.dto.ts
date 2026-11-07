import { ApiPropertyOptional } from '@nestjs/swagger';
import { DateOnlyQuery } from '../../common/dto/pagination.dto';

export class DoctorStatsQueryDto {
  @ApiPropertyOptional({
    example: '2026-09-01',
    description: 'payments.date >= (kun)',
  })
  @DateOnlyQuery()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-09-30',
    description: 'payments.date <= (kun)',
  })
  @DateOnlyQuery()
  endDate?: string;
}
