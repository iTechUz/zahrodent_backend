import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
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
  @Max(2_000_000_000, { message: 'Summa 2 000 000 000 dan oshmasligi kerak' })
  price: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  duration: number;

  @IsOptional()
  @IsString()
  description?: string;
}
