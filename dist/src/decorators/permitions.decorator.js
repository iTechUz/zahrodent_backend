"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IsPermissionsObject = IsPermissionsObject;
const class_validator_1 = require("class-validator");
const allowedActions = ['read', 'create', 'update', 'remove', 'view', 'filter', 'export', 'import', 'upload', 'print', 'share', 'archive', 'restore', 'delete'];
function IsPermissionsObject(validationOptions) {
    return function (object, propertyName) {
        (0, class_validator_1.registerDecorator)({
            name: 'isPermissionsObject',
            target: object.constructor,
            propertyName,
            options: validationOptions,
            validator: {
                validate(value, args) {
                    if (typeof value !== 'object' || value === null)
                        return false;
                    for (const menuKey in value) {
                        const actions = value[menuKey];
                        if (typeof actions !== 'object' || actions === null)
                            return false;
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
                defaultMessage(args) {
                    return `'${args.property}' must be a valid permissions object with actions: ${allowedActions.join(', ')}`;
                },
            },
        });
    };
}
//# sourceMappingURL=permitions.decorator.js.map