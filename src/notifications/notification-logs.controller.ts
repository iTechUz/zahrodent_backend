import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { NotificationLogService } from './notification-log.service';

class NotificationLogsQueryDto extends PaginationQueryDto {
  @IsOptional() @IsIn(['pending', 'sent', 'failed']) status?: string;
  @IsOptional() @IsString() kind?: string;
}

@ApiTags('notifications')
@ApiBearerAuth('JWT')
@Controller('notification-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'receptionist')
export class NotificationLogsController {
  constructor(private readonly logs: NotificationLogService) {}

  @Get()
  @ApiOperation({ summary: 'Telegram yuborish tarixi (sent/failed/pending)' })
  findAll(@Query() q: NotificationLogsQueryDto) {
    return this.logs.findAll(q);
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Oxirgi 24 soatdagi xatolar va navbat (ogohlantirish)',
  })
  summary() {
    return this.logs.summary();
  }

  @Post(':id/retry')
  @ApiOperation({ summary: 'Muvaffaqiyatsiz xabarni qayta yuborish' })
  retry(@Param('id') id: string) {
    return this.logs.retry(id);
  }
}
