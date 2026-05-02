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

          // SaaS isolation logic
          // If we have a branchId, we apply isolation.
          // For SUPER_ADMIN, we ONLY skip isolation if NO branchId is provided in CLS.
          // This allows SUPER_ADMIN to switch branch context using headers.
          if (branchId) {
            
            // Skip isolation ONLY if SuperAdmin AND no branchId was set in the context
            // Actually, if branchId is set, we SHOULD isolate.
            // The only case to skip is when SuperAdmin wants to see EVERYTHING (branchId is null/undefined)
            
            // Models that strictly belong to a branch
            const tenantModels = [
              'Patient',
              'Booking',
              'Payment',
              'Visit',
              'Notification',
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
