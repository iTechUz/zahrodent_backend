import { PrismaClient, UserRole } from '@prisma/client';
import { ClsService } from 'nestjs-cls';

/**
 * Prisma Extension to automatically inject tenant isolation (branchId)
 * into all database queries.
 */
export const tenantIsolationExtension = (cls: ClsService) => {
  return {
    name: 'tenant-isolation',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const branchId = cls.get('branchId');
          const userRole = cls.get('userRole');

          // If we have a branchId and the user is NOT a SUPER_ADMIN,
          // we must enforce data isolation.
          if (branchId && userRole !== UserRole.SUPER_ADMIN) {
            
            // Models that strictly belong to a branch
            const tenantModels = [
              'Patient',
              'Booking',
              'Payment',
              'Visit',
              'Notification',
              'Doctor',
              'Lead',
              'Service',
              'User',
              'AuditLog',
              'PatientComment',
              'Inventory'
            ];

            if (tenantModels.includes(model)) {
              // 1. For READ operations, inject where: { branchId }
              if (['findMany', 'findFirst', 'findUnique', 'count', 'aggregate', 'groupBy'].includes(operation)) {
                args.where = { ...args.where, branchId };
              }

              // 2. For WRITE operations, ensure branchId is set
              if (['create', 'createMany'].includes(operation)) {
                if (args.data) {
                  if (Array.isArray(args.data)) {
                    args.data = args.data.map((item: any) => ({ ...item, branchId }));
                  } else {
                    args.data.branchId = branchId;
                  }
                }
              }

              if (['update', 'updateMany', 'upsert'].includes(operation)) {
                args.where = { ...args.where, branchId };
              }
            }
          }

          return query(args);
        },
      },
    },
  };
};
