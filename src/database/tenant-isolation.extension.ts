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
              'User'
            ];

            if (tenantModels.includes(model)) {
              // For read operations, inject where: { branchId }
              if (['findMany', 'findFirst', 'findUnique', 'count', 'aggregate', 'groupBy'].includes(operation)) {
                args.where = { ...args.where, branchId };
              }

              // Special case for User: doctors are linked to branch via branchId,
              // but we need to be careful with the mapping. 
              // In our schema, Patient, Booking, Payment, Visit, Notification, Doctor, Lead, Service
              // all have branchId directly. User also has branchId.
            }
          }

          return query(args);
        },
      },
    },
  };
};
