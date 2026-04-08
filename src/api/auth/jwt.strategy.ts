import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { PrismaService } from '../../prisma.service'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
	constructor(
		private configService: ConfigService,
		private prisma: PrismaService
	) {
		super({
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			secretOrKey: configService.get('JWT_SECRET')
		})
	}

	async validate(payload: { sub: string; role: string }) {


		const user = await this.prisma.user.findUnique({
			where: { id: payload.sub },
			select: {
				id: true,
				phone: true,
				currentBranchId: true,
				roles:{
					select: {
						id: true,
						name: true
					}
				},

				
			}
		})
		if (!user) {
			throw new UnauthorizedException('User not found')
		}

		
		
		
		return {
			...user,
			id: user.id,
			phone: user.phone,
			roles: user.roles,
			roleName: user.roles.name,
			roleId: user.roles.id,
			currentBranchId: user.currentBranchId,
		}
	}
}
