import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

const allowedActions = ['read', 'create', 'update', 'remove', 'view', 'filter', 'export', 'import', 'upload', 'print', 'share', 'archive', 'restore', 'delete'];

export function IsPermissionsObject(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isPermissionsObject',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {

          
          if (typeof value !== 'object' || value === null) return false;

          for (const menuKey in value) {
            const actions = value[menuKey];
            if (typeof actions !== 'object' || actions === null) return false;

            for (const action in actions) {
              if (!allowedActions.includes(action)) {
                return false;
              }

              if (typeof actions[action] !== 'boolean') {
                return false;
              }
            }
          }

          return true;
        },
        defaultMessage(args: ValidationArguments) {
          return `'${args.property}' must be a valid permissions object with actions: ${allowedActions.join(
            ', '
          )}`;
        },
      },
    });
  };
}
