"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiKeyEnums = void 0;
const common_1 = require("@nestjs/common");
const apiKeys = 'HIKIVISTION';
const ApiKeyEnums = (key) => (0, common_1.SetMetadata)(apiKeys, key);
exports.ApiKeyEnums = ApiKeyEnums;
//# sourceMappingURL=check-x-api-key.decorator.js.map