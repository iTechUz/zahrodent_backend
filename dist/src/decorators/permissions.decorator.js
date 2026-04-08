"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequirePermission = exports.PERMISSION_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.PERMISSION_KEY = 'requiredPermission';
const RequirePermission = (action) => (0, common_1.SetMetadata)(exports.PERMISSION_KEY, action);
exports.RequirePermission = RequirePermission;
//# sourceMappingURL=permissions.decorator.js.map