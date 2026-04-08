import { Module } from "@nestjs/common";

import { AuthModule } from './auth/auth.module';
import { BranchModule } from './branch/branch.module';
import { DateTimeModule } from './date-time/date-time.module';
import { MinioClientModule } from './minio/minio-client.module';
import { RolesModule } from './roles/roles.module';
import { UsersModule } from './users/users.module';

import { AdminModule } from './admin/admin.module';
@Module({
	imports: [
		AuthModule,
		UsersModule,
		MinioClientModule,
		DateTimeModule,
		RolesModule,
		BranchModule,
		AdminModule,

	],
})
export class ApiModule { }