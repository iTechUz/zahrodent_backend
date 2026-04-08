import { ExecutionContext, Injectable } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
      constructor(private prisma: PrismaService) {
        super();
      }
    
      async canActivate(context: ExecutionContext): Promise<boolean> {
        const can = (await super.canActivate(context)) as boolean;
        if (!can) return false;
    
        const request = context.switchToHttp().getRequest();
        const user = request.user;

        
        
        request.user = {
          ...user,
      
        };
    
        return true;
      }
}
