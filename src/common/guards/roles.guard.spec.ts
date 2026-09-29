import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY, Roles } from '../decorators/roles.decorator';
import {
  ROLES_DOCTOR_WRITE,
  ROLES_FINANCE,
  ROLES_STAFF,
} from '../constants/role-groups';

describe('RolesGuard', () => {
  let reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;
  let guard: RolesGuard;

  const ctx = (user?: { role: string }) =>
    ({
      getHandler: () => 'handler',
      getClass: () => 'class',
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('rollar talab qilinmasa — ruxsat', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(ctx())).toBe(true);
    reflector.getAllAndOverride.mockReturnValue([]);
    expect(guard.canActivate(ctx())).toBe(true);
  });

  it('handler va class metadata tekshiriladi', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);
    guard.canActivate(ctx({ role: 'admin' }));
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
      'handler',
      'class',
    ]);
  });

  it('mos rol — ruxsat', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin', 'receptionist']);
    expect(guard.canActivate(ctx({ role: 'receptionist' }))).toBe(true);
  });

  it('mos bo‘lmagan rol — 403', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);
    expect(() => guard.canActivate(ctx({ role: 'doctor' }))).toThrow(
      ForbiddenException,
    );
  });

  it('user yo‘q — 403', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);
    expect(() => guard.canActivate(ctx(undefined))).toThrow(
      'Insufficient role',
    );
  });
});

describe('Roles decorator va role guruhlari', () => {
  it('Roles metadata ni ROLES_KEY ostida yozadi', () => {
    class C {
      @Roles('admin', 'doctor')
      m() {
        return 1;
      }
    }
    const reflector = new Reflector();
    expect(reflector.get(ROLES_KEY, C.prototype.m)).toEqual([
      'admin',
      'doctor',
    ]);
  });

  it('guruhlar kutilgan tarkibda', () => {
    expect(ROLES_STAFF).toEqual(['admin', 'doctor', 'receptionist']);
    expect(ROLES_FINANCE).toEqual(['admin']);
    expect(ROLES_DOCTOR_WRITE).toEqual(['admin', 'doctor']);
  });
});
