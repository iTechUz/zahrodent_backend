import { ApiProperty } from '@nestjs/swagger'
import { IsString, MinLength } from 'class-validator'

export class AdminLoginDto {
	@ApiProperty({ example: '+998900000000', description: 'Username' })
	@IsString()
	phone: string

	@ApiProperty({ example: 'admin!@#$%', description: 'Password' })
	@IsString()
	@MinLength(5)
	password: string
}
