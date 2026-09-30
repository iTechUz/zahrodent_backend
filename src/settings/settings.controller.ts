import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsResponseDto } from './dto/settings-response.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ROLES_STAFF } from '../common/constants/role-groups';

@ApiTags('settings')
@ApiBearerAuth('JWT')
@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ROLES_STAFF)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Klinika sozlamalari (barcha xodimlar)' })
  @ApiOkResponse({ type: SettingsResponseDto })
  get() {
    return this.settingsService.get();
  }

  @Patch()
  @Roles('admin')
  @ApiOperation({
    summary: 'Sozlamalarni yangilash (faqat admin)',
    description:
      "Qisman yangilash — faqat yuborilgan maydonlar o'zgaradi. Shablonlar ≤ 500 belgi, reminderDaysAhead 0..7.",
  })
  @ApiOkResponse({ type: SettingsResponseDto })
  @ApiForbiddenResponse({ description: "Bu amal uchun ruxsat yo'q" })
  update(@Body() dto: UpdateSettingsDto) {
    return this.settingsService.update(dto);
  }
}
