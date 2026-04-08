
import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'requiredPermission';

export const RequirePermission = (action: string) =>
  SetMetadata(PERMISSION_KEY, action);
