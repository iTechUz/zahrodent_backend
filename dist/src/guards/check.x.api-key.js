"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var CheckXApiKeyGuard_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckXApiKeyGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const constantis_1 = require("../constantis");
let CheckXApiKeyGuard = CheckXApiKeyGuard_1 = class CheckXApiKeyGuard {
    constructor(reflector) {
        this.reflector = reflector;
        this.apiKeyHikivistion = process.env.X_API_KEY_HIKIVISTION;
        this.logger = new common_1.Logger(CheckXApiKeyGuard_1.name);
    }
    canActivate(context) {
        const requiredKeys = this.reflector.getAllAndOverride('HIKIVISTION', [context.getHandler(), context.getClass()]);
        const request = context.switchToHttp().getRequest();
        const apiKey = request.headers['x-api-key'];
        this.logger.log(`ApiKey: ${apiKey}`);
        if (!apiKey) {
            throw new common_1.ForbiddenException('YOUR NOT ACCESS TO THIS RESOURCE');
        }
        const hashXApiKey = (0, constantis_1.decodeUUID)(apiKey);
        if (!hashXApiKey) {
            throw new common_1.ForbiddenException('YOUR NOT ACCESS TO THIS RESOURCE');
        }
        if (hashXApiKey === this.apiKeyHikivistion) {
            return true;
        }
        this.logger.warn(`Invalid API Key: ${apiKey}`);
        throw new common_1.ForbiddenException('YOUR NOT ACCESS TO THIS RESOURCE');
    }
};
exports.CheckXApiKeyGuard = CheckXApiKeyGuard;
exports.CheckXApiKeyGuard = CheckXApiKeyGuard = CheckXApiKeyGuard_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector])
], CheckXApiKeyGuard);
//# sourceMappingURL=check.x.api-key.js.map