"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RolesD = exports.ROLES_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.ROLES_KEY = 'roles';
const RolesD = (...roles) => (0, common_1.SetMetadata)(exports.ROLES_KEY, roles);
exports.RolesD = RolesD;
//# sourceMappingURL=role.decorator.js.map