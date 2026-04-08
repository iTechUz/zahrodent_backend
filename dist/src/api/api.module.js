"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiModule = void 0;
const common_1 = require("@nestjs/common");
const auth_module_1 = require("./auth/auth.module");
const branch_module_1 = require("./branch/branch.module");
const date_time_module_1 = require("./date-time/date-time.module");
const minio_client_module_1 = require("./minio/minio-client.module");
const roles_module_1 = require("./roles/roles.module");
const users_module_1 = require("./users/users.module");
const admin_module_1 = require("./admin/admin.module");
let ApiModule = class ApiModule {
};
exports.ApiModule = ApiModule;
exports.ApiModule = ApiModule = __decorate([
    (0, common_1.Module)({
        imports: [
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            minio_client_module_1.MinioClientModule,
            date_time_module_1.DateTimeModule,
            roles_module_1.RolesModule,
            branch_module_1.BranchModule,
            admin_module_1.AdminModule,
        ],
    })
], ApiModule);
//# sourceMappingURL=api.module.js.map