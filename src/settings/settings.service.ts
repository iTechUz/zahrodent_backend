import { Injectable } from '@nestjs/common';
import { ClinicSettings } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { DEFAULT_REMINDER_TEMPLATE } from './reminder-template';

export const SETTINGS_ID = 1;

export type SettingsView = {
  clinicName: string;
  address: string;
  phone: string;
  workingHours: string;
  smsReminderTemplate: string;
  telegramReminderTemplate: string;
  reminderDaysAhead: number;
};

/** Values used if the row is missing (the migration normally inserts it). */
const DEFAULTS = {
  id: SETTINGS_ID,
  smsReminderTemplate: DEFAULT_REMINDER_TEMPLATE,
  telegramReminderTemplate: DEFAULT_REMINDER_TEMPLATE,
};

/** Single-row clinic settings (`clinic_settings.id = 1`). */
@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<SettingsView> {
    const row =
      (await this.prisma.clinicSettings.findUnique({
        where: { id: SETTINGS_ID },
      })) ??
      (await this.prisma.clinicSettings.upsert({
        where: { id: SETTINGS_ID },
        create: DEFAULTS,
        update: {},
      }));
    return this.toView(row);
  }

  async update(dto: UpdateSettingsDto): Promise<SettingsView> {
    const row = await this.prisma.clinicSettings.upsert({
      where: { id: SETTINGS_ID },
      create: { ...DEFAULTS, ...dto },
      update: dto,
    });
    return this.toView(row);
  }

  private toView(row: ClinicSettings): SettingsView {
    return {
      clinicName: row.clinicName,
      address: row.address,
      phone: row.phone,
      workingHours: row.workingHours,
      smsReminderTemplate: row.smsReminderTemplate,
      telegramReminderTemplate: row.telegramReminderTemplate,
      reminderDaysAhead: row.reminderDaysAhead,
    };
  }
}
