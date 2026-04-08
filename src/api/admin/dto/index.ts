import { ApiProperty, PartialType } from '@nestjs/swagger'
import { IsArray, IsString } from 'class-validator'

export class CreateAdminDto {
	@ApiProperty({ example: '+1234567890', description: 'User phone number' })
	@IsString()
	phone: string

	@ApiProperty({ example: 'johndoe', description: 'firstName' })
	@IsString()
	firstName?: string

	@ApiProperty({ example: 'johndoe', description: 'lastName' })
	@IsString()
	lastName?: string

	@ApiProperty({ example: 'password123', description: 'User password' })
	@IsString()
	password?: string

	@ApiProperty({
		example: ['uuid'],
		description: 'User branches'
	})
	@ApiProperty({ example: 'cuid', description: 'Branch IDs' })
	@IsArray()
	branchIds: string[]
}

export class UpdateAdminDto extends PartialType(CreateAdminDto) {}
