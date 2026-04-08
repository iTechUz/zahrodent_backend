import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import { IsArray, IsOptional, IsString } from 'class-validator'
import { PaginationDto } from 'src/utils/paginations'
import { IsCuid } from 'src/validator/cuid'

export class CreateUserDto {
	@ApiProperty({ example: 'John', description: 'First name' })
	@IsString()
	firstName?: string

	@ApiProperty({ example: 'Doe', description: 'Last name' })
	@IsString()
	lastName?: string

	@ApiProperty({ example: '+1234567890', description: 'User phone number' })
	@IsString()
	phone: string

	@ApiPropertyOptional({ example: 'password123', description: 'User password' })
	@IsOptional()
	@IsString()
	password?: string

	@ApiProperty({ example: 'file url', description: 'file url' })
	@IsString()
	@IsOptional()
	
	image: string

	@ApiProperty({
		example: 'uuid',
		description: 'User role'
	})
	@IsCuid()
	roleId: string

	@ApiProperty({
		example: 'uuid',
		description: 'Current Branch Id'
	})
	@IsCuid()
	currentBranchId: string

	@ApiProperty({
		example: ['uuid'],
		description: 'User branches'
	})
	@IsArray()
	branchIds: string[]
}

export class UpdateUserDto extends PartialType(CreateUserDto) {}

export class filterByUserDto extends PaginationDto {
	@ApiProperty({
		required: false,
		description: 'Role id'
	})
	@IsOptional()
	@IsCuid()
	roleId: string
}

export class SetCurrentBranchDto {
	@ApiProperty({ example: 'uuid', description: 'Branch Id' })
	@IsString()
	@IsCuid()
	branchId: string
}

// export class VisitorQuery extends PaginationDto {
// 	@ApiPropertyOptional({ description: 'childId to filter by' })
// 	@IsOptional()
// 	@IsString()
// 	childId?: string
// }

export class UserProfileDto {
	@ApiProperty({ example: 'John', description: 'First name' })
	@IsString()
	firstName?: string

	@ApiProperty({ example: 'Doe', description: 'Last name' })
	@IsString()
	lastName?: string

	@ApiProperty({ example: '+1234567890', description: 'Phone number' })
	@IsString()
	phone?: string
}

interface Permissions {
	read: boolean
	create: boolean
	update: boolean
	remove: boolean
	view: boolean
	export: boolean
	filter: boolean
	import: boolean
	print: boolean
	share: boolean
	upload: boolean
	restore: boolean
}

interface Roles {
	id: string
	name: string
	permissions: {
		all: Permissions
	}
}

export interface IUserProfileDto {
	id: string
	firstName: string | null
	lastName: string | null
	phone: string
	image: string | null
	currentBranchId: string | null
	studentGroups: any[] 
	teachingGroups: any[] 
	roles: Roles
	branches: any[] 
	createdAt: string 
	updatedAt: string 
}
