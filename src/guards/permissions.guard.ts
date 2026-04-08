// permissions.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from '../decorators/permissions.decorator';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector, private readonly prisma: PrismaService) {}

 async canActivate(context: ExecutionContext): Promise<boolean> {
    const action = this.reflector.get<string>(PERMISSION_KEY, context.getHandler());

    if (!action) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;    
    if(user.roleName === 'SUPER_ADMIN') return true;
    const path = request.route.path;
    const moduleName = extractModuleFromPath(path);

    const findRolePermis = await this.prisma.permission.findFirst({
      where:{
        roleId: user.roleId,
        name: moduleName
      },
      include:{
        role: {
          select:{
            name: true
          }
        }
      }
    })

    
    if (!findRolePermis) {
      throw new ForbiddenException('No permissions assigned');
    }

    const hasPermission = findRolePermis[action];
    
    if (!hasPermission) {
      throw new ForbiddenException(`Permission "${action}" denied for module "${moduleName}"`);
    }

    return true;
  }
}

function extractModuleFromPath(path: string): string {
  const parts = path.split('/');
  return parts[2] || 'unknown';
}
