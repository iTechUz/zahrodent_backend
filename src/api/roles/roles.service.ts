import {
	BadRequestException,
	Injectable,
	NotFoundException
} from '@nestjs/common'
import { RolesEnum } from 'src/constantis'
import { PrismaService } from 'src/prisma.service'
import { RoleCreateDto, RoleUpdateDto } from './dto'
@Injectable()
export class RolesService {
	constructor(private readonly prisma: PrismaService) {}

	async findAll(pagination, user) {
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
	async findOne(id: string, user) {
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

	async create(data: RoleCreateDto, user) {
		const { name, permissions } = data

		const _data = await this.prisma.$transaction(async ctx => {
			const role = await ctx.roles.findFirst({ where: { name } })
			if (role)
				throw new BadRequestException('Role already exists with this name')

			const createRole = await ctx.roles.create({
				data: { name }
			})

			for (let key in permissions) {
				await ctx.permission.create({
					data: {
						roleId: createRole.id,
						name: key,
						...permissions[key]
					}
				})
			}

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

	async update(id: string, data: RoleUpdateDto, user) {
		const item = await this.findOne(id, user)
		const per = data.permissions

		return await this.prisma.$transaction(async ctx => {
			for (let key in per) {
				const find = await ctx.permission.findFirst({
					where: {
						roleId: id,
						name: key
					}
				})
				if (find)
					await ctx.permission.update({
						where: { id: find.id },
						data: per[key]
					})
				if (!find) {
					await ctx.permission.create({
						data: {
							roleId: item.id,
							name: key,
							...per[key]
						}
					})
				}
			}
			return true
		})
	}

	async remove(id: string, user) {
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
