import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
    private cls: ClsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // SuperAdmin bypasses subscription checks
    if (!user || user.role === 'SUPER_ADMIN') return true;

    const branchId = this.cls.get('branchId');
    if (!branchId) return true; // Should not happen with TenantInterceptor

    // Skip check for GET requests (allow viewing data)
    if (request.method === 'GET') return true;

    const subscription = await this.prisma.branchSubscription.findUnique({
      where: { branchId },
      include: { plan: true },
    });

    if (!subscription || subscription.status !== 'ACTIVE') {
      throw new ForbiddenException(
        'Sizda faol obuna mavjud emas. Iltimos, tarifni yangilang yoki admin bilan bog\'laning.',
      );
    }

    // Check expiration date
    if (subscription.endDate && new Date() > subscription.endDate) {
      // Auto-update status to INACTIVE if expired
      await this.prisma.branchSubscription.update({
        where: { branchId },
        data: { status: 'INACTIVE' },
      });
      throw new ForbiddenException(
        'Obuna muddati tugagan. Iltimos, tarifni yangilang.',
      );
    }

    return true;
  }
}
