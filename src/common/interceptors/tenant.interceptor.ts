import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { ClsService } from 'nestjs-cls';

/**
 * Interceptor to extract tenant information (branchId) from the authenticated user
 * and store it in the ClsService (AsyncLocalStorage) for global access.
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly cls: ClsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (user) {
      // Store branchId and user context in the current request's async storage
      this.cls.set('branchId', user.branchId);
      this.cls.set('userId', user.id);
      this.cls.set('userRole', user.role);
    }

    return next.handle();
  }
}
