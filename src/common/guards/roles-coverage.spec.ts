import 'reflect-metadata';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { GUARDS_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RolesGuard } from './roles.guard';

function controllerFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return controllerFiles(p);
    return n.endsWith('.controller.ts') ? [p] : [];
  });
}

/**
 * RolesGuard denies routes without @Roles, so every handler of a controller
 * that uses RolesGuard MUST have @Roles (method or class level). This test
 * fails the build when a new route forgets it.
 */
describe('RolesGuard coverage — every guarded route has explicit @Roles', () => {
  const files = controllerFiles(join(__dirname, '../..'));

  it('controllers are discovered', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it('no route relies on the "no roles" default', () => {
    const missing: string[] = [];
    let checked = 0;
    for (const f of files) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require(f) as Record<string, unknown>;
      for (const exp of Object.values(mod)) {
        if (typeof exp !== 'function') continue;
        const guards = (Reflect.getMetadata(GUARDS_METADATA, exp) ??
          []) as unknown[];
        if (!guards.includes(RolesGuard)) continue;
        const proto = (exp as { prototype: Record<string, unknown> }).prototype;
        for (const name of Object.getOwnPropertyNames(proto)) {
          const handler = proto[name];
          if (typeof handler !== 'function') continue;
          if (Reflect.getMetadata(METHOD_METADATA, handler) === undefined) {
            continue; // not a route
          }
          checked++;
          const roles =
            (Reflect.getMetadata(ROLES_KEY, handler) as string[] | undefined) ??
            (Reflect.getMetadata(ROLES_KEY, exp) as string[] | undefined);
          if (!roles?.length)
            missing.push(`${(exp as { name: string }).name}.${name}`);
        }
      }
    }
    expect(checked).toBeGreaterThan(50); // sanity: reflection really sees the routes
    expect(missing).toEqual([]);
  });
});
