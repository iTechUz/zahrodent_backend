import {
	ConflictException,
	Injectable,
	NotFoundException
} from '@nestjs/common'
import { User } from '@prisma/client'
import { RolesEnum, STATUS } from 'src/constantis'
import { PrismaService } from 'src/prisma.service'
import { HashingService } from 'src/utils/hashing/hashing.service'
import { PaginationDto } from 'src/utils/paginations'
import { CreateAdminDto, UpdateAdminDto } from './dto'

@Injectable()
export class AdminService {
	constructor(
		private readonly prismaService: PrismaService,
		private readonly hashService: HashingService
	) {}

	async findAll(pagination: PaginationDto, user: User) {
		const { page, pageSize, search } = pagination
		let where = {}
		if (search) {
			where = {
				OR: [
					{ phone: { contains: search, mode: 'insensitive' } },
					{ firstName: { contains: search, mode: 'insensitive' } },
					{ lastName: { contains: search, mode: 'insensitive' } }
				]
			}
		}
		const data = await this.prismaService.user.findMany({
			where: {
				...where,
				status: STATUS.ACTIVE,
				roles: {
					name: RolesEnum.ADMIN
				}
			},
			include: {
				roles: {
					select: { name: true, id: true }
				},
				branches: {
					select: { id: true, name: true }
				}
			},
			skip: (page - 1) * pageSize,
			take: pageSize
		})
		const total = await this.prismaService.user.count({
			where: { ...where, status: STATUS.ACTIVE, roles: {name: RolesEnum.ADMIN}}
		})

		return {
			data,
			meta: {
				page,
				pageSize,
				total,
				pageCount: Math.ceil(total / pageSize)
			}
		}
	}

	async findOne(id: string, user: User) {
		const foundUser = await this.prismaService.user.findUnique({
			where: { id, roles: {
				name: RolesEnum.ADMIN
			} },
			include: {
				roles: true,
				branches: true
			}
		})
		if (!foundUser) {
			throw new NotFoundException(`User with ID ${id} not found`)
		}
		return foundUser
	}

	async create(data: CreateAdminDto, user: User) {
		const adminRole = await this.prismaService.roles.findFirst({
			where: { name: RolesEnum.ADMIN }
		})
		if (!adminRole) {
			throw new NotFoundException('Admin role not found')
		}
		const isExists = await this.prismaService.user.findFirst({
			where: {
				phone: data.phone,
				roles: {
					id: adminRole.id
				}
			}
		})

		if (isExists)
			throw new ConflictException('Admin already exists with this phone number')

		return await this.prismaService.user.create({
			data: {
				phone: data.phone,
				firstName: data.firstName,
				lastName: data.lastName,
				password: await this.hashService.hashPassword(data.password),
				roles: {
					connect: {
						id: adminRole.id
					}
				},
				branches: {
					connect: data.branchIds.map(branchId => ({ id: branchId }))
				}
			}
		})
	}

	async update(id: string, data: UpdateAdminDto, user: User) {
		await this.findOne(id, user)
		const { branchIds, ...datas } = data
		const areBranchesExist = await this.prismaService.branch.findMany({
			where: { id: { in: branchIds } }
		})
		if(branchIds?.length){
			datas['branches'] ={
				set: branchIds.map(branchId => ({ id: branchId }))
			}
		}
		if(datas.password) datas.password = await this.hashService.hashPassword(data.password)
		return await this.prismaService.user.update({
			where: { id },
			data: {
				...datas
			}
		})
	}

	async remove(id: string, user: User) {
		await this.findOne(id, user)
		return await this.prismaService.user.update({
			where: { id },
			data: {
				status: STATUS.DELETED
			}
		})
	}
}
