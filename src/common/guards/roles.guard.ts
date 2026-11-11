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
    // Deny by default: a route under RolesGuard without @Roles is a mistake
    // (forgotten decorator) — never "open to every logged-in role".
    // Routes meant for any authenticated user use JwtAuthGuard alone (no RolesGuard);
    // public routes have no guards. roles-coverage.spec.ts checks every route.
    if (!required?.length) {
      throw new ForbiddenException(FORBIDDEN_MESSAGE);
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
