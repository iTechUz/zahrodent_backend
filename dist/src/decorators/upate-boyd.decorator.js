"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateDecorator = UpdateDecorator;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
function UpdateDecorator(dtoClass) {
    return (0, common_1.applyDecorators)((0, swagger_1.ApiOperation)({ summary: 'Update item' }), (0, swagger_1.ApiBody)({ type: dtoClass }));
}
//# sourceMappingURL=upate-boyd.decorator.js.map