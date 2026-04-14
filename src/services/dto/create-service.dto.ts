import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateServiceDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(1)
  category: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  price: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  duration: number;

  @IsOptional()
  @IsString()
  description?: string;
}
