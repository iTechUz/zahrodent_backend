import { ApiProperty } from '@nestjs/swagger'
import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator'
import { IsPermissionsObject } from 'src/decorators'
import { IsCuid } from 'src/validator/cuid'

export class RoleCreateDto {
	@ApiProperty({ example: 'name', description: 'name' })
	@IsString()
	name: string

	@ApiProperty({
		example: {
			users: {
				read: true,
				create: false,
				update: true,
				remove: false,
				view: true,
				filter: false
			}
		},
		description: 'permissions'
	})
	@IsObject()
	@IsPermissionsObject({
		message:
			'Each permission must be an object with only these actions: read, create, update, remove, view, filter and their values must be boolean.'
	})
	permissions: {
		[menu: string]: {
			[action: string]: boolean
		}
	}

	// @ApiProperty({ example: 'question count', description: 'question count' })
	// @IsNumber()
	// questionCount: number

	// @ApiProperty({ example: 'file url', description: 'file url' })
	// @IsString()
	// file: string

	// @ApiPropertyOptional({ example: 'startDate', description: 'YYYY-MM-DD HH:mm' })
	// @IsString()
	// startDate: string

	// @ApiPropertyOptional({ example: 'duration', description: 'Int' })
	// @IsNumber()
	// duration: number

	// @ApiPropertyOptional({ example: 'uuid', description: 'techerId' })
	// @IsOptional()
	// @IsString()
	// @IsCuid()
	// teacherId: string

	// @ApiPropertyOptional({ example: 'uuid', description: 'groupId' })
	// @IsString()
	// @IsCuid()
	// groupId: string
}

export class RoleUpdateDto {
	@ApiProperty({ example: 'name', description: 'name' })
	@IsString()
	name: string

		@ApiProperty({
		example: {
			users: {
				read: true,
				create: false,
				update: true,
				remove: false,
				view: true,
				filter: false
			}
		},
		description: 'permissions'
	})
	@IsObject()
	@IsPermissionsObject({
		message:
			'Each permission must be an object with only these actions: read, create, update, remove, view, filter and their values must be boolean.'
	})
	
	permissions: {
		[menu: string]: {
			[action: string]: boolean
		}
}
}
export class PermissionUpdateDto {
	@ApiProperty({ example: 'name', description: 'name' })
	@IsString()
	@IsOptional()
	name: string

	@ApiProperty({ example: true, description: 'Should be boolean' })
	@IsOptional()
	@IsBoolean()
	read: boolean
	@ApiProperty({ example: true, description: 'Should be boolean' })
	@IsOptional()
	@IsBoolean()
	create: boolean
	@ApiProperty({ example: true, description: 'Should be boolean' })
	@IsOptional()
	@IsBoolean()
	update: boolean
	@ApiProperty({ example: true, description: 'Should be boolean' })
	@IsOptional()
	@IsBoolean()
	remove: boolean
	@ApiProperty({ example: true, description: 'Should be boolean' })
	@IsOptional()
	@IsBoolean()
	view: boolean
	@ApiProperty({ example: true, description: 'Should be boolean' })
	@IsOptional()
	@IsBoolean()
	filter: boolean
	@ApiProperty({ example: true, description: 'Should be boolean' })
	@IsOptional()
	@IsBoolean()
	export: boolean
	@ApiProperty({ example: true, description: 'Should be boolean' })
	@IsOptional()
	@IsBoolean()
	import: boolean
	@ApiProperty({ example: true, description: 'Should be boolean' })
	@IsOptional()
	@IsBoolean()
	upload: boolean
	@ApiProperty({ example: true, description: 'Should be boolean' })
	@IsOptional()
	@IsBoolean()
	print: boolean
	@ApiProperty({ example: true, description: 'Should be boolean' })
	@IsOptional()
	@IsBoolean()
	share: boolean
	@ApiProperty({ example: true, description: 'Should be boolean' })
	@IsOptional()
	@IsBoolean()
	restore: boolean
}
