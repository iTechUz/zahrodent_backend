import { Logger } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'
import { initilRoles, OutcomeReasonDescriptions, permit_list, RolesEnum } from '../src/constantis'



const prisma = new PrismaClient()
const logger = new Logger('Seed')




async function main() {
	const adminPhone = process.env.ADMIN_PHONE || '+998900000000'
	const adminPassword = process.env.ADMIN_PASSWORD || 'admin!@#$%'


	for (const roleData of initilRoles) {
		const existingRole = await prisma.roles.findFirst({
			where: { name: roleData.name }
		})

		if (!existingRole) {
			const data = await prisma.roles.create({
				data: {
					name: roleData.name,
				}
			})

			await prisma.permission.create({
				data: {
					roleId: data.id,
					name: 'all',
					...permit_list
				}
			})
			logger.log(`Role created: ${roleData.name}`)
		} else {
			logger.log(`Role already exists: ${existingRole.name}`)
		}
	}
	const findSuperAdmin = await prisma.roles.findFirst({
		where: { name: RolesEnum.SUPER_ADMIN }
	})

	const existingAdmin = await prisma.user.findFirst({
		where: {
			phone: adminPhone,
			roles: {
				name: RolesEnum.SUPER_ADMIN
			}

		}
	})
	if (!existingAdmin) {
		const hashedPassword = await bcrypt.hash(adminPassword, 10)
		const admin = await prisma.user.create({
			data: {
				phone: adminPhone,
				password: hashedPassword,
				roleId: findSuperAdmin.id,
			}
		})

		logger.log(`Admin created: ${admin.phone}`)
	} else {
		logger.log('Admin already exists')
	}



}

main()
	.catch(e => {
		logger.error(e)
		process.exit(1)
	})
	.finally(async () => {
		await prisma.$disconnect()
	})
