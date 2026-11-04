import { Prisma } from '@prisma/client';

/**
 * Models soft-deleted via `deletedAt`. `Patient` is handled by its own
 * repository (restore, includeDeleted) but hard delete is forbidden there too.
 */
export const SOFT_DELETE_MODELS = [
  'User',
  'Doctor',
  'Service',
  'Booking',
  'Payment',
  'Lead',
] as const;

const READ_ACTIONS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
]);

const UNIQUE_TO_FIRST: Record<string, string> = {
  findUnique: 'findFirst',
  findUniqueOrThrow: 'findFirstOrThrow',
};

export const HARD_DELETE_FORBIDDEN =
  'Hard delete taqiqlangan: soft delete ishlating';

const withLive = (where: Record<string, unknown> | undefined) =>
  where && 'deletedAt' in where ? where : { ...where, deletedAt: null };

/**
 * Nobody hard-deletes: `delete`/`deleteMany` become `deletedAt = now()` and
 * reads hide soft-deleted rows. Nested relation filters are NOT covered —
 * keep `deletedAt: null` in nested `include.where` by hand.
 */
export const softDeleteMiddleware: Prisma.Middleware = async (params, next) => {
  const { model, action } = params;

  if (model === 'Patient' && (action === 'delete' || action === 'deleteMany')) {
    throw new Error(HARD_DELETE_FORBIDDEN);
  }
  if (!model || !(SOFT_DELETE_MODELS as readonly string[]).includes(model)) {
    return next(params);
  }

  if (action === 'delete') {
    params.action = 'update';
    params.args.data = { deletedAt: new Date() };
  } else if (action === 'deleteMany') {
    params.action = 'updateMany';
    params.args = params.args ?? {};
    params.args.where = withLive(params.args.where);
    params.args.data = { deletedAt: new Date() };
  } else if (action in UNIQUE_TO_FIRST) {
    params.action = UNIQUE_TO_FIRST[action] as Prisma.PrismaAction;
    params.args.where = withLive(params.args.where);
  } else if (READ_ACTIONS.has(action)) {
    params.args = params.args ?? {};
    params.args.where = withLive(params.args.where);
  }
  return next(params);
};
