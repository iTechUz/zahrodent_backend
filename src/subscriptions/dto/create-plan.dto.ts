import { IsString, IsNumber, IsBoolean, IsArray, IsOptional, Min } from 'class-validator';

export class CreatePlanDto {
  @IsString()
  name: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsArray()
  features: string[];

  @IsBoolean()
  @IsOptional()
  isPopular?: boolean;
}
