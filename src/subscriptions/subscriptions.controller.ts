import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, UseGuards, HttpCode, HttpStatus, Req,
  ForbiddenException,
} from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { AssignPlanDto } from './dto/assign-plan.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole, SubscriptionStatus } from '@prisma/client';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubscriptionsController {
  constructor(private readonly service: SubscriptionsService) {}

  // ─── Tariflar (Plans) ────────────────────────────────────────────────

  @Get('plans')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  getPlans() {
    return this.service.getPlans();
  }

  @Post('plans')
  @Roles(UserRole.SUPER_ADMIN)
  createPlan(@Body() dto: CreatePlanDto) {
    return this.service.createPlan(dto);
  }

  @Patch('plans/:id')
  @Roles(UserRole.SUPER_ADMIN)
  updatePlan(@Param('id') id: string, @Body() dto: Partial<CreatePlanDto>) {
    return this.service.updatePlan(id, dto);
  }

  @Delete('plans/:id')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  deletePlan(@Param('id') id: string) {
    return this.service.deletePlan(id);
  }

  // ─── Obunalar (Branch Subscriptions) ─────────────────────────────────

  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  getAllSubscriptions() {
    return this.service.getAllSubscriptions();
  }

  @Get('my')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  getMySubscription(@Req() req: any) {
    const branchId = req.user.branchId;
    if (!branchId) return null;
    return this.service.getSubscriptionByBranch(branchId);
  }

  @Get('history/:branchId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  getHistory(@Param('branchId') branchId: string, @Req() req: any) {
    // Regular admin can only see their own branch history
    if (req.user.role === UserRole.ADMIN && req.user.branchId !== branchId) {
      throw new ForbiddenException('Siz faqat o\'z filialingiz tarixini ko\'ra olasiz');
    }
    return this.service.getHistory(branchId);
  }

  @Post('assign')
  @Roles(UserRole.SUPER_ADMIN)
  assignPlan(@Body() dto: AssignPlanDto) {
    return this.service.assignPlan(dto);
  }

  @Patch(':branchId/status')
  @Roles(UserRole.SUPER_ADMIN)
  updateStatus(
    @Param('branchId') branchId: string,
    @Body('status') status: SubscriptionStatus,
  ) {
    return this.service.updateSubscriptionStatus(branchId, status);
  }

  // ─── SaaS Metrikalari ─────────────────────────────────────────────

  @Get('metrics')
  @Roles(UserRole.SUPER_ADMIN)
  getMetrics() {
    return this.service.getSaasMetrics();
  }
}
