import {
	Injectable,
	NotFoundException,
	UnauthorizedException
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'
import { UsersService } from 'src/api/users/users.service'
import { STATUS } from 'src/constantis'
import { HashingService } from 'src/utils/hashing'
import { PrismaService } from '../../prisma.service'
import { AdminLoginDto } from './dto'
import { ChangePasswordDto } from './dto/change-password.dto'

@Injectable()
export class AuthService {
	constructor(
		private prisma: PrismaService,
		private jwtService: JwtService,
		private usersService: UsersService,
		private hashingService: HashingService
	) { }
	async login(loginDto: AdminLoginDto) {
		const user = await this.prisma.user.findFirst({
			where: {
				phone: loginDto.phone,
				status: {
					in: [STATUS.ACTIVE]
				}
			},
			include: {
				roles: {
					select: {
						id: true
					}
				},
				branches: true
			}
		})
		if (!user) {
			throw new UnauthorizedException('User not found')
		}
		const isPasswordValid = await bcrypt.compare(loginDto.password, user.password)
		if (!isPasswordValid) {
			throw new UnauthorizedException('Invalid password')
		}
		const token = this.jwtService.sign({ sub: user.id, role: user.roles.id })

		return {
			token,
			branches: user.branches.map(branch => branch)
		}
	}

	async changePassword(changePasswordDto: ChangePasswordDto) {
		const user = await this.prisma.user.findUnique({
			where: {
				phone: changePasswordDto.phone
			}
		})

		if (!user) throw new NotFoundException("User not found")

		const isPasswordValid = await bcrypt.compare(changePasswordDto.oldPassword, user.password)
		if (!isPasswordValid) {
			throw new UnauthorizedException('Invalid password')
		}

		const hashedPassword = await this.hashingService.hashPassword(changePasswordDto.newPassword)
		return await this.prisma.user.update({
			where: {
				phone: changePasswordDto.phone
			},
			data: {
				password: hashedPassword
			}
		})
	}

}
