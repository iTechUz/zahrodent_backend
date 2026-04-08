import { ApiProperty } from '@nestjs/swagger';
import { IsEmpty, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { IsCuid } from 'src/validator/cuid';
enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC'
}
export class PaginationDto {
  @Transform(({ value }) => parseInt(value))
  @ApiProperty({
    required: false,
    default: 1,
    description: 'Page number',
  })
  @IsOptional()
  @IsInt({ message: 'Page number must be an integer' })
  @Min(1)
  page: number = 1;

  @Transform(({ value }) => parseInt(value))
  @ApiProperty({
    required: false,
    default: 10,
    description: 'Page size',
  })
  @IsOptional()
  @IsInt({ message: 'Page size must be an integer' })
  @Min(1)
  @Max(100)
  pageSize: number = 10;

  @ApiProperty({
    required: false,
    description: 'Search query',
  })
  @IsOptional()
  @IsString({ message: 'Sort by must be a string' })
  search: string;

  @ApiProperty({
    required: false,
    default: 'ASC',
    description: 'Order direction',
    enum: SortOrder,
  })
  @IsOptional()
  @IsEnum(SortOrder, { message: 'Sort direction must be ASC or DESC' })
  sortBy: SortOrder = SortOrder.ASC;

  // @ApiProperty({
  //   required:false
  // })
  // @ApiProperty({required: false, description: 'Optional'})
  // @IsCuid()
  // @IsOptional()
  // groupId?: string
}


export class MetaDto {
  @ApiProperty({ example: 1, description: 'Current page number' })
  page: number;

  @ApiProperty({ example: 10, description: 'Number of items per page' })
  pageSize: number;

  @ApiProperty({ example: 5, description: 'Total number of pages' })
  pageCount: number;

  @ApiProperty({ example: 50, description: 'Total number of items' })
  total: number;
}
  
export class PaginationResponse<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    pageCount: number;
    total: number;
  };
}
