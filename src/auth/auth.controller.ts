import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService, AuthUserView, SessionMeta } from './auth.service';
import { LoginDto } from './dto/login.dto';
import {
  LoginResponseDto,
  MeResponseDto,
  SuccessResponseDto,
} from './dto/login-response.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';

function sessionMeta(req: Request): SessionMeta {
  return {
    userAgent: req.header('user-agent') ?? undefined,
    ip: req.ip ?? undefined,
  };
}

@ApiTags('auth')
@Controller('auth')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 25, ttl: 60_000 } })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({
    summary: 'Kirish',
    description:
      'Telefon raqami va parol bilan access (JWT) va refresh token olish',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 201,
    description: 'Muvaffaqiyatli',
    type: LoginResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "Telefon raqami yoki parol noto'g'ri",
  })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, sessionMeta(req));
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Tokenlarni yangilash (rotation)',
    description:
      "Refresh token bekor qilinib yangisi beriladi. Bekor qilingan token qayta ishlatilsa — shu login'dan kelib chiqqan barcha sessiyalar bekor qilinadi.",
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Sessiya muddati tugagan, qayta kiring',
  })
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.authService.refresh(dto.refresh_token, sessionMeta(req));
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Chiqish',
    description: 'Refresh tokenni bekor qiladi (idempotent).',
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiOkResponse({ type: SuccessResponseDto })
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refresh_token);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Joriy foydalanuvchi' })
  @ApiOkResponse({ type: MeResponseDto })
  @ApiUnauthorizedResponse({ description: "Token yo'q yoki yaroqsiz" })
  me(@GetUser() user: AuthUserView) {
    return this.authService.me(user);
  }

  @Patch('password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: "O'z parolini o'zgartirish",
    description:
      'Muvaffaqiyatli bo‘lsa foydalanuvchining barcha refresh tokenlari bekor qilinadi (boshqa qurilmalardan chiqariladi).',
  })
  @ApiBody({ type: ChangePasswordDto })
  @ApiOkResponse({ type: SuccessResponseDto })
  @ApiBadRequestResponse({ description: "Joriy parol noto'g'ri / validatsiya" })
  changePassword(
    @GetUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(userId, dto);
  }
}
