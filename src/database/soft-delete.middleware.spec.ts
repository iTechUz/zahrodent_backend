import { Prisma } from '@prisma/client';
import {
  SOFT_DELETE_MODELS,
  softDeleteMiddleware,
} from './soft-delete.middleware';

type Params = Prisma.MiddlewareParams;

const run = async (params: Partial<Params>) => {
  const next = jest.fn().mockResolvedValue('ok');
  const full = { args: {}, dataPath: [], runInTransaction: false, ...params };
  await softDeleteMiddleware(full as Params, next);
  return next.mock.calls[0][0] as Params;
};

describe('softDeleteMiddleware', () => {
  it.each(SOFT_DELETE_MODELS)(
    '%s: delete → update deletedAt',
    async (model) => {
      const out = await run({
        model,
        action: 'delete',
        args: { where: { id: '1' } },
      });
      expect(out.action).toBe('update');
      expect(out.args.where).toEqual({ id: '1' });
      expect(out.args.data.deletedAt).toBeInstanceOf(Date);
    },
  );

  it('deleteMany → updateMany deletedAt (live rows only)', async () => {
    const out = await run({
      model: 'Lead',
      action: 'deleteMany',
      args: { where: { status: 'new' } },
    });
    expect(out.action).toBe('updateMany');
    expect(out.args.where).toEqual({ status: 'new', deletedAt: null });
    expect(out.args.data.deletedAt).toBeInstanceOf(Date);
  });

  it.each(['findMany', 'findFirst', 'count', 'aggregate', 'groupBy'])(
    '%s hides deleted rows',
    async (action) => {
      const out = await run({
        model: 'Booking',
        action: action as Params['action'],
        args: { where: { status: 'pending' } },
      });
      expect(out.args.where).toEqual({ status: 'pending', deletedAt: null });
    },
  );

  it('adds where when args are empty', async () => {
    const out = await run({ model: 'Payment', action: 'findMany' });
    expect(out.args.where).toEqual({ deletedAt: null });
  });

  it('findUnique → findFirst with deletedAt null', async () => {
    const out = await run({
      model: 'User',
      action: 'findUnique',
      args: { where: { phone: '+998901234567' } },
    });
    expect(out.action).toBe('findFirst');
    expect(out.args.where).toEqual({ phone: '+998901234567', deletedAt: null });
  });

  it('findUniqueOrThrow → findFirstOrThrow', async () => {
    const out = await run({
      model: 'Doctor',
      action: 'findUniqueOrThrow',
      args: { where: { id: 'd' } },
    });
    expect(out.action).toBe('findFirstOrThrow');
    expect(out.args.where).toEqual({ id: 'd', deletedAt: null });
  });

  it('explicit deletedAt in where is respected (admin/restore lookups)', async () => {
    const out = await run({
      model: 'Service',
      action: 'findMany',
      args: { where: { deletedAt: { not: null } } },
    });
    expect(out.args.where).toEqual({ deletedAt: { not: null } });
  });

  it('update/create pass through untouched', async () => {
    const args = { where: { id: '1' }, data: { name: 'x' } };
    const out = await run({ model: 'User', action: 'update', args });
    expect(out.action).toBe('update');
    expect(out.args).toEqual(args);
  });

  it('Patient: hard delete is forbidden', async () => {
    await expect(
      run({ model: 'Patient', action: 'delete', args: { where: { id: '1' } } }),
    ).rejects.toThrow('Hard delete');
    await expect(
      run({ model: 'Patient', action: 'deleteMany' }),
    ).rejects.toThrow('Hard delete');
  });

  it('other models are untouched', async () => {
    const out = await run({ model: 'Visit', action: 'findMany', args: {} });
    expect(out.args).toEqual({});
  });
});
