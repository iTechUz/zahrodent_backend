import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsOptional, IsString } from "class-validator";
import { IsCuid } from "src/validator/cuid";

export class checkById {
      @ApiProperty({ required: true, example: 'uuid', description: 'Lesson ID' })
      @IsString()
      @IsCuid()
      id: string;
}


export class startEndDateDto {
    @ApiProperty({ required: false, example: '2024-01-01', description: 'Start Date' })
    @IsString()
    @IsOptional()
    startDate: string;

    @ApiProperty({ required: false, example: '2026-01-31', description: 'End Date' })
    @IsString()
    @IsOptional()
    endDate: string;
}

export class monthDto {
    @ApiProperty({ required: false, example: 'sentabr', description: 'Month Name' })
    @IsString()
    @IsOptional()
    month: string;   
    @ApiProperty({ required: false, example: 2026, description: 'Year' })
    @IsString()
    @IsOptional()
    year: string;
}