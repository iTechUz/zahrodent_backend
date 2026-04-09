import {
	BadRequestException,
	Injectable,
	NotFoundException
} from '@nestjs/common'
import { RolesEnum } from 'src/constantis'
import { PrismaService } from 'src/prisma.service'
import { RoleCreateDto } from './dto'
import { PaginationDto } from '@/utils/paginations'
import { IUserProfileDto } from '../users/dto/user.dto'
@Injectable()
export class RolesService {
	constructor(private readonly prisma: PrismaService) {}

	async findAll(pagination:PaginationDto, user: IUserProfileDto) {
		const { page, pageSize, search, sortBy } = pagination
		let where: any = {
			name: {
				not: RolesEnum.SUPER_ADMIN
			}
		}
		if (search) {
			where = {
				['AND']: [
					{ name: { not: RolesEnum.SUPER_ADMIN } },
					{
						name: {
							contains: search,
							mode: 'insensitive'
						}
					}
				]
			}
		}
		const data = await this.prisma.roles.findMany({
			where,
			take: pageSize,
			skip: (page - 1) * pageSize,
			orderBy: {
				createdAt: sortBy.toLocaleLowerCase() === 'asc' ? 'asc' : 'desc'
			},
			include: {
				permission: true,
				_count: {
					select: {
						permission: true
					}
				}
			}
		})

		const total = await this.prisma.roles.count()

		return {
			data,
			meta: {
				total,
				page,
				pageSize,
				pageCount: Math.ceil(total / pageSize)
			}
		}
	}
	async findOne(id: string, user: IUserProfileDto) {
		let role = await this.prisma.roles.findUnique({
			where: { id },
			include: {
				users: true,
				permission: true
			}
		})
		if (!role) {
			throw new NotFoundException(`Role with ID ${id} not found`)
		}
		role['permissions'] = role.permission.reduce((acc, el) => {
			acc[el.name] = {
				...el
			}
			return acc
		}, {})
		//  delete role.permission

		return role
	}

	async create(data: RoleCreateDto, user: IUserProfileDto) {
		const { name } = data

		const _data = await this.prisma.$transaction(async ctx => {
			const role = await ctx.roles.findFirst({ where: { name } })
			if (role)
				throw new BadRequestException('Role already exists with this name')

			const createRole = await ctx.roles.create({
				data: { name }
			})


			return await ctx.roles.findFirst({
				where: {
					name
				},
				include: {
					permission: true
				}
			})
		})

		return _data
	}

	
	async remove(id: string, user: IUserProfileDto) {
		const role = await this.findOne(id,user)

		if (role.users.length > 0) {
			throw new NotFoundException(
				'Role cannot be deleted because it is assigned to users'
			)
		}

		return await this.prisma.$transaction(async ctx => {
			const role = await ctx.roles.findFirst({
				where: {
					id
				},
				include: {
					permission: true
				}
			})

			const per = role.permission
			for (let i = 0; i < per.length; i++) {
				const { id } = per[i]
				await ctx.permission.delete({
					where: {
						id
					}
				})
			}

			await ctx.roles.delete({
				where: { id }
			})

			return { success: true, message: 'role success remove' }
		})
	}

	async getSomeRoles() {
		const arr = ['STUDENT', 'TEACHER', 'SUPER_ADMIN', 'ADMIN']
		return this.prisma.roles.findMany({
			where: {
				name: {
					notIn: arr
				}
			}
		})
	}
}
