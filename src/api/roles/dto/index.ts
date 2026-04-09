import { ApiProperty } from '@nestjs/swagger'
import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator'
import { IsCuid } from 'src/validator/cuid'

export class RoleCreateDto {
	@ApiProperty({ example: 'name', description: 'name' })
	@IsString()
	name: string
}

