import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ListQueryDto } from '../../common/dto/pagination.dto';

export const SERVICE_SORT_FIELDS = [
  'name',
  'category',
  'price',
  'duration',
] as const;
export type ServiceSortField = (typeof SERVICE_SORT_FIELDS)[number];

export class ServicesQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ description: "Kategoriya yoki 'all'" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional({
    enum: SERVICE_SORT_FIELDS,
    description: 'Standart: category asc, name asc',
  })
  @IsOptional()
  @IsIn(SERVICE_SORT_FIELDS)
  sortBy?: ServiceSortField;
}
