import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { GetUser } from './get-user.decorator';

function getFactory() {
  class TestController {
    handler(@GetUser() _user: unknown) {
      return _user;
    }
  }
  const meta = Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    TestController,
    'handler',
  );
  const key = Object.keys(meta)[0];
  return meta[key].factory as (data: unknown, ctx: ExecutionContext) => any;
}

describe('GetUser decorator', () => {
  const factory = getFactory();
  const ctx = (user: unknown) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  const user = { id: 'u1', name: 'A', phone: '+998', role: 'admin' };

  it('data siz — butun user', () => {
    expect(factory(undefined, ctx(user))).toBe(user);
  });

  it('data bilan — faqat maydon', () => {
    expect(factory('id', ctx(user))).toBe('u1');
  });

  it('user yo‘q va data bor — undefined (xatosiz)', () => {
    expect(factory('id', ctx(undefined))).toBeUndefined();
  });
});
