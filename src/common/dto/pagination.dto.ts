import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  page?: number = 0;

  @ApiPropertyOptional({ minimum: 1, maximum: 100000, default: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  @IsOptional()
  limit?: number = 10;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
}
