import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ROLES_STAFF } from '../common/constants/role-groups';
import { GetUser } from '../common/decorators/get-user.decorator';
import { AuthUserView } from '../auth/auth.service';
import {
  DashboardQueryDto,
  MonthlyQueryDto,
  SourcesQueryDto,
} from './dto/analytics-query.dto';
import {
  DashboardResponseDto,
  MonthlyPointDto,
  SourcePointDto,
} from './dto/analytics-response.dto';

@ApiTags('analytics')
@ApiBearerAuth('JWT')
@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ROLES_STAFF)
@ApiForbiddenResponse({
  description: 'Rol ruxsat etilmagan yoki shifokor profili bog‘lanmagan',
})
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({
    summary: 'Dashboard ko‘rsatkichlari',
    description:
      'doctor — faqat o‘z bemorlari/qabullari. Pul maydonlari faqat admin uchun, qolganlarga null.',
  })
  @ApiOkResponse({ type: DashboardResponseDto })
  getDashboard(
    @Query() query: DashboardQueryDto,
    @GetUser() user: AuthUserView,
  ) {
    return this.analyticsService.getDashboard(user, query.date);
  }

  @Get('monthly')
  @ApiOperation({
    summary: 'Oylik dinamika (eskidan yangiga, bo‘sh oylar ham)',
    description:
      'doctor — o‘z bemorlari/qabullari. revenue/expenses faqat admin uchun, qolganlarga null.',
  })
  @ApiOkResponse({ type: MonthlyPointDto, isArray: true })
  getMonthly(@Query() query: MonthlyQueryDto, @GetUser() user: AuthUserView) {
    return this.analyticsService.getMonthly(user, query.months ?? 6);
  }

  @Get('sources')
  @ApiOperation({
    summary: 'Manbalar bo‘yicha taqsimot',
    description:
      'Standart: qabullar (bookings) manba bo‘yicha. ?type=patients — bemorlar manbasi. doctor — faqat o‘ziniki. Ko‘pdan kamga.',
  })
  @ApiOkResponse({ type: SourcePointDto, isArray: true })
  getSources(@Query() query: SourcesQueryDto, @GetUser() user: AuthUserView) {
    return this.analyticsService.getSources(user, query.type ?? 'bookings');
  }
}
