import { ConfigService } from '@nestjs/config'
import { JwtModuleOptions } from '@nestjs/jwt'
import { log } from 'console'

export const getJwtConfig = async (
	configService: ConfigService
): Promise<JwtModuleOptions> => {

	log(configService.get('JWT_SECRET'))
	return {
	secret: configService.get('JWT_SECRET')
}
}


