import 'reflect-metadata';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { DoctorsController } from '../../doctors/doctors.controller';
import { NotificationsController } from '../../notifications/notifications.controller';
import { ServicesController } from '../../services/services.controller';
import { PatientsController } from '../../patients/patients.controller';
import { AnalyticsController } from '../../analytics/analytics.controller';
import { UsersController } from '../../users/users.controller';

/** Effective roles of a handler (method-level overrides class-level). */
function rolesOf(controller: { prototype: object }, method: string) {
  const handler = (controller.prototype as Record<string, unknown>)[method];
  return (
    (Reflect.getMetadata(ROLES_KEY, handler as object) as string[]) ??
    (Reflect.getMetadata(ROLES_KEY, controller) as string[])
  );
}

describe('Role contract (admin panel)', () => {
  it.each<[string, { prototype: object }, string, string[]]>([
    [
      'GET /doctors',
      DoctorsController,
      'findAll',
      ['admin', 'receptionist', 'doctor'],
    ],
    [
      'GET /doctors/:id',
      DoctorsController,
      'findOne',
      ['admin', 'receptionist', 'doctor'],
    ],
    ['POST /doctors', DoctorsController, 'create', ['admin']],
    ['PATCH /doctors/:id', DoctorsController, 'update', ['admin']],
    ['DELETE /doctors/:id', DoctorsController, 'remove', ['admin']],
    ['GET /doctors/efficiency', DoctorsController, 'getEfficiency', ['admin']],
    [
      'GET /notifications',
      NotificationsController,
      'findAll',
      ['admin', 'receptionist', 'doctor'],
    ],
    [
      'POST /notifications/bulk-send',
      NotificationsController,
      'bulkSend',
      ['admin', 'receptionist'],
    ],
    [
      'GET /services/stats',
      ServicesController,
      'getStats',
      ['admin', 'receptionist'],
    ],
    ['DELETE /patients/:id', PatientsController, 'remove', ['admin']],
    [
      'GET /analytics/dashboard',
      AnalyticsController,
      'getDashboard',
      ['admin', 'doctor', 'receptionist'],
    ],
    [
      'GET /analytics/monthly',
      AnalyticsController,
      'getMonthly',
      ['admin', 'doctor', 'receptionist'],
    ],
    [
      'GET /analytics/sources',
      AnalyticsController,
      'getSources',
      ['admin', 'doctor', 'receptionist'],
    ],
    ['GET /users', UsersController, 'findAll', ['admin']],
  ])('%s', (_route, controller, method, expected) => {
    expect([...rolesOf(controller, method)].sort()).toEqual(
      [...expected].sort(),
    );
  });
});
