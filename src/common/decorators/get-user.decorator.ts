import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUserView } from '../../auth/auth.service';

export const GetUser = createParamDecorator(
  (data: keyof AuthUserView | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthUserView;

    return data ? user?.[data] : user;
  },
);
