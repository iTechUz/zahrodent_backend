"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IsCuid = IsCuid;
const class_validator_1 = require("class-validator");
function IsCuid(validationOptions) {
    return function (object, propertyName) {
        (0, class_validator_1.registerDecorator)({
            name: 'isCuid',
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            validator: {
                validate(value, _args) {
                    return typeof value === 'string' && /^c[a-z0-9]{24}$/.test(value);
                },
                defaultMessage() {
                    return '$property must be a valid CUID';
                },
            },
        });
    };
}
//# sourceMappingURL=cuid.js.map