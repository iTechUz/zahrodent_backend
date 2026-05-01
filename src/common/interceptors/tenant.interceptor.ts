import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { ClsService } from 'nestjs-cls';

/**
 * Enhanced TenantInterceptor for SaaS SuperAdmin.
 * Allows SuperAdmin to override context using 'x-branch-id' header.
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly cls: ClsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (user) {
      let branchId = user.branchId;

      // If SuperAdmin provides a branch ID in the header, override the context
      if (user.role === 'SUPER_ADMIN') {
        const headerBranchId = request.headers['x-branch-id'];
        if (headerBranchId) {
          branchId = headerBranchId;
        }
      }

      this.cls.set('branchId', branchId);
      this.cls.set('userId', user.id);
      this.cls.set('userRole', user.role);
    }

    return next.handle();
  }
}
