import { Body, Controller, Post } from '@nestjs/common'
import {
	ApiBearerAuth,
	ApiOperation,
	ApiResponse,
	ApiTags
} from '@nestjs/swagger'
import { AuthService } from './auth.service'

import { AdminLoginDto } from './dto'
import { ChangePasswordDto } from './dto/change-password.dto'

@ApiTags('auth')
@Controller('auth')
export class AuthController {
	constructor(private readonly authService: AuthService) {}


	@Post('login')
	@ApiOperation({ summary: 'Login' })
	@ApiResponse({ status: 200, description: 'User logged in successfully' })
	login(@Body() loginDto: AdminLoginDto) {
		return this.authService.login(loginDto)
	}

	@Post('change-password')
	@ApiOperation({ summary: 'Change Password' })
	@ApiResponse({ status: 200, description: 'Password changed successfully' })
	changePassword(@Body() changePasswordDto: ChangePasswordDto) {
		return this.authService.changePassword(changePasswordDto)
	}

	
}
