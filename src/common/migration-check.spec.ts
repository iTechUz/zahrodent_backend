import { spawnSync } from 'child_process';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const script = join(__dirname, '../../scripts/check-migrations.sh');

function run(sql: string) {
  const dir = mkdtempSync(join(tmpdir(), 'mig-'));
  const f = join(dir, 'migration.sql');
  writeFileSync(f, sql);
  return spawnSync('bash', [script, '--files', f], { encoding: 'utf8' });
}

describe('scripts/check-migrations.sh', () => {
  it('additive migration passes', () => {
    expect(
      run(
        'CREATE INDEX IF NOT EXISTS "a" ON "t"("c");\nALTER TABLE "t" ADD COLUMN "x" TEXT;',
      ).status,
    ).toBe(0);
  });

  it.each([
    'ALTER TABLE "t" DROP COLUMN "x";',
    'drop table "t";',
    'ALTER TABLE "t" ALTER COLUMN "x" TYPE INTEGER;',
    'ALTER TABLE "t" ALTER COLUMN "x" SET DATA TYPE INTEGER;',
  ])('%s fails without marker', (sql) => {
    expect(run(sql).status).toBe(1);
  });

  it('passes with -- allow-destructive marker', () => {
    expect(
      run('-- allow-destructive\nALTER TABLE "t" DROP COLUMN "x";').status,
    ).toBe(0);
  });

  it('commented-out DROP is ignored', () => {
    expect(run('-- DROP TABLE "t";\nSELECT 1;').status).toBe(0);
  });
});
