import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class BranchCreateDto {
    @ApiProperty({ example: 'Main Branch', description: 'Name of the branch' })
    @IsString()
    name: string;

    @ApiProperty({ example: '123 Main St, City, Country', description: 'Address of the branch' })
    @IsString()
    @IsOptional()
    address: string;


    @ApiProperty({ example: '+1234567890', description: 'Contact number of the branch' })
    @IsString()
    @IsOptional()
    phone: string;


    @ApiProperty({ example: 'This is the main branch of our organization.', description: 'Description of the branch' })
    @IsString()
    @IsOptional()
    description: string;
  
}