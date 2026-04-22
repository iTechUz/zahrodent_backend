import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AdminInitService implements OnModuleInit {
  private readonly logger = new Logger(AdminInitService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureAdminExists();
  }

  private async ensureAdminExists() {
    const adminCount = await this.prisma.user.count({
      where: { role: 'admin' },
    });

    if (adminCount === 0) {
      this.logger.log('Hech qanday admin topilmadi. Super admin yaratilmoqda...');

      const phone = process.env.INITIAL_ADMIN_PHONE || '+998901234567';
      const password = process.env.INITIAL_ADMIN_PASSWORD || 'admin123';
      const name = process.env.INITIAL_ADMIN_NAME || 'Dr. Zahro Admin';

      const passwordHash = await bcrypt.hash(password, 10);

      try {
        await this.prisma.user.create({
          data: {
            name,
            phone,
            passwordHash,
            role: 'admin',
          },
        });
        this.logger.log(`Super admin muvaffaqiyatli yaratildi: ${phone}`);
      } catch (error) {
        this.logger.error('Super adminni yaratishda xatolik:', error);
      }
    } else {
      this.logger.log(`Tizimda ${adminCount} ta admin mavjud.`);
    }
  }
}
