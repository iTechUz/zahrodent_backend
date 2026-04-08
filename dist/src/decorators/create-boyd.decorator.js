"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateDecorator = CreateDecorator;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
function CreateDecorator(dtoClass) {
    return (0, common_1.applyDecorators)((0, swagger_1.ApiOperation)({ summary: 'Create new item' }), (0, swagger_1.ApiBody)({ type: dtoClass }));
}
//# sourceMappingURL=create-boyd.decorator.js.map