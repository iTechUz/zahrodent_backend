import { Injectable, NotFoundException } from '@nestjs/common'
import { phoneRegEx, RolesEnum, STATUS } from 'src/constantis'
import { HashingService } from 'src/utils/hashing'
import { PrismaService } from '../../prisma.service'
import { DateTimeService } from '../date-time/date-time.service'
import { CreateUserDto, filterByUserDto, IUserProfileDto } from './dto/user.dto'
@Injectable()
export class UsersService {
	constructor(
		private prisma: PrismaService,
		private dateTimeService: DateTimeService,
		private hashService: HashingService
	) {}
	async findAll(pagination: filterByUserDto) {
		const { page, pageSize, search, sortBy, roleId } = pagination
		let where = {}
		if (roleId) {
			const role = await this.prisma.roles.findFirst({
				where: {
					id: roleId,
					name: {
						notIn: [RolesEnum.SUPER_ADMIN]
					}
				}
			})
			if (!role) throw new NotFoundException('Role not found')
			where['roleId'] = roleId
		}

		const total = await this.prisma.user.count({
			where: {
				...where,
				status: STATUS.ACTIVE,
				roles: {
					name: {
						notIn: [RolesEnum.SUPER_ADMIN]
					}
				}
			}
		})

		const data = await this.prisma.user.findMany({
			take: pageSize,
			skip: (page - 1) * pageSize,
			where: {
				...where,
				status: STATUS.ACTIVE,
				roles: {
					name: {
						notIn: [RolesEnum.SUPER_ADMIN]
					}
				},
				OR: search
					? [
							{ firstName: { contains: search, mode: 'insensitive' } },
							{ lastName: { contains: search, mode: 'insensitive' } },
							{ phone: { contains: search, mode: 'insensitive' } }
						]
					: undefined
			},
			orderBy: {
				createdAt: sortBy.toLocaleLowerCase() === 'asc' ? 'asc' : 'desc'
			},
			include: {
				roles: {
					select: {
						id: true,
						name: true
					}
				},
				branches: {
					select: {
						id: true,
						name: true,
						address: true,
						phone: true
					}
				}
			}
		})
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

	async findOne(id: string, currentUser?: IUserProfileDto) {
		const user = await this.prisma.user.findUnique({
			where: { id, status: STATUS.ACTIVE },
			select: {
				id: true,
				firstName: true,
				lastName: true,
				phone: true,
				image: true,
				// currentBranchId: true,

				roles: {
					select: {
						id: true,
						name: true,
						// permissions: true
						permission: {
							select: {
								id: true,
								name: true,
								read: true,
								create: true,
								update: true,
								remove: true,
								view: true,
								export: true,
								filter: true,
								import: true,
								print: true,
								share: true,
								upload: true,
								restore: true,
								roleId: true
							}
						}
					}
				},
				branches: true,
				createdAt: true,
				updatedAt: true
			}
		})

		if (!user) {
			throw new NotFoundException('User not found')
		}

		user.roles['permissions'] = user.roles.permission.reduce((acc, el) => {
			acc[el.name] = {
				read: el.read,
				create: el.create,
				update: el.update,
				remove: el.remove,
				view: el.view,
				export: el.export,
				filter: el.filter,
				import: el.import,
				print: el.print,
				share: el.share,
				upload: el.upload,
				restore: el.restore
			}
			return acc
		}, {})

		if (user.roles.name === RolesEnum.SUPER_ADMIN) {
			user.roles['permissions'] = {
				all: true
			}
		}
		delete user.roles.permission

		return user
	}

	async setCurrentBranch(user: IUserProfileDto, branchId: string) {
		const branchData = await this.prisma.user.findFirst({
			where: {
				id: user.id,
				status: STATUS.ACTIVE,
				branches: {
					some: {
						id: branchId
					}
				}
			}
		})
		if (!branchData)
			throw new NotFoundException(
				'Branch does not exist or you do not have access'
			)

		return await this.prisma.user.update({
			where: { id: user.id },
			data: { currentBranchId: branchId }
		})
	}

	async remove(id: string) {
		const user = await this.prisma.user.findUnique({ where: { id } })
		if (!user) {
			throw new NotFoundException('User not found')
		}
		return this.prisma.user.update({
			where: { id },
			data: { status: STATUS.DELETED }
		})
	}

	async create(user: IUserProfileDto, data: CreateUserDto) {
		let arr = ['STUDENT', 'TEACHER', 'SUPER_ADMIN', 'ADMIN']
		const branchId = user.currentBranchId || data.currentBranchId
		if (!branchId) throw new NotFoundException('branch does not exist')
		if (phoneRegEx.test(data.phone) === false) {
			throw new NotFoundException('Phone number is not valid')
		}
		const itemUser = await this.prisma.user.findFirst({
			where: {
				phone: data.phone
			}
		})

		if (itemUser) {
			throw new NotFoundException(
				'User already exists or phone number already exists'
			)
		}

		const { roleId, branchIds, ...rest } = data
		const role = await this.prisma.roles.findUnique({
			where: {
				id: roleId
			}
		})
		if (!role || arr.includes(role.name))
			throw new NotFoundException(
				'Role does not exist or you do not have access'
			)

		const ids = branchIds.map(el => ({ id: el }))
		const hashPassword = await this.hashService.hashPassword(rest.password)

		return await this.prisma.user.create({
			data: {
				...rest,
				roles: {
					connect: {
						id: data.roleId
					}
				},
				password: hashPassword,
				branches: {
					connect: ids
				}
			}
		})
	}

	async update(id: string, data: Partial<CreateUserDto>) {
		{
			await this.findOne(id)
			if (data.phone && phoneRegEx.test(data.phone) === false) {
				throw new NotFoundException('Phone number is not valid')
			}
			if (data.branchIds?.length) {
				const ids = await data.branchIds.map(el => ({ id: el }))
				data['branches'] = {
					connect: ids
				}
				delete data.branchIds
			}
			if (data.password) {
				data.password = await this.hashService.hashPassword(data.password)
			}
			return await this.prisma.user.update({
				where: { id, status: STATUS.ACTIVE },
				data: {
					...data
				}
			})
		}
	}

	async numberOfUsers() {
		const allUsers = await this.prisma.user.count({
			where: {
				status: STATUS.ACTIVE
			}
		})
		
		const admins = await this.prisma.user.count({
			where: {
				status: STATUS.ACTIVE,
				roles: {
					name: {
						notIn: [RolesEnum.SUPER_ADMIN]
					}
				}
			}
		})
		return {
			count: {
				all: allUsers,
				admins: admins
			}
		}
	}
}
