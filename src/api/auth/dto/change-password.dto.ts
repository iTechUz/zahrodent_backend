import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class ChangePasswordDto {
    @ApiProperty({example: "+1234567890", description: "Phone number" })
    @IsString()
    phone: string;

    @ApiProperty({example: 'old_password', description: 'Old password'})
    @IsString()
    oldPassword: string;
    
    @ApiProperty({example: 'new_password', description: 'New password'})
    @IsString()
    newPassword: string;
}