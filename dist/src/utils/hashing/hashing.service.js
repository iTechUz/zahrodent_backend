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
Object.defineProperty(exports, "__esModule", { value: true });
exports.HashingService = void 0;
const common_1 = require("@nestjs/common");
const bcrypt = require("bcrypt");
const node_crypto_1 = require("node:crypto");
let HashingService = class HashingService {
    constructor() {
        this.saltOrRounds = 10;
    }
    async hashPassword(password) {
        const salt = await bcrypt.genSalt(this.saltOrRounds);
        return await bcrypt.hash(password, salt);
    }
    async comparePassword(password, hashedPassword) {
        return await bcrypt.compare(password, hashedPassword);
    }
    md5(content, algo = 'md5') {
        const hashFunc = (0, node_crypto_1.createHash)(algo);
        hashFunc.update(content);
        return hashFunc.digest('hex');
    }
};
exports.HashingService = HashingService;
exports.HashingService = HashingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], HashingService);
//# sourceMappingURL=hashing.service.js.map