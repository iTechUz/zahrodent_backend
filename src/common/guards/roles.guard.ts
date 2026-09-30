import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, AppRole } from '../decorators/roles.decorator';

export const FORBIDDEN_MESSAGE = "Bu amal uchun ruxsat yo'q";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<AppRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) {
      return true;
    }
    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: { role: AppRole } }>();
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException(FORBIDDEN_MESSAGE);
    }
    return true;
  }
}
