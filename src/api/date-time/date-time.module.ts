import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { DateTimeService } from './date-time.service'

@Global()
@Module({
	imports: [ConfigModule],
	providers: [DateTimeService],
	exports: [DateTimeService]
})
export class DateTimeModule {}
