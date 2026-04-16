import { Module } from "@nestjs/common";

import { AuthModule } from './auth/auth.module';
import { BranchModule } from './branch/branch.module';
import { DateTimeModule } from './date-time/date-time.module';
import { MinioClientModule } from './minio/minio-client.module';
import { RolesModule } from './roles/roles.module';
import { UsersModule } from './users/users.module';
import { NotificationsModule } from "./notifications/notifications.module";
import { PatientModule } from "./patient/patient.module";

@Module({
	imports: [
		AuthModule,
		UsersModule,
		MinioClientModule,
		DateTimeModule,
		RolesModule,
		BranchModule,
		NotificationsModule,
		PatientModule

	],
})
export class ApiModule { }