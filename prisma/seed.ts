import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

// .env faylni yuklash
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const hash = (plain: string) => bcrypt.hash(plain, 10);

  // Admin ma'lumotlarini .env dan olish va qo'shtirnoqlardan tozalash
  const adminPhone = (process.env.INITIAL_ADMIN_PHONE || '+998901234567').replace(/^["']|["']$/g, '');
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'admin123';
  const adminName = (process.env.INITIAL_ADMIN_NAME || 'Dr. Zahro Admin').replace(/^["']|["']$/g, '');

  console.log(`Seeding: Admin phone set to ${adminPhone}`);

  // Deletion order to satisfy foreign key constraints
  await prisma.patientComment.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.visit.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.service.deleteMany();
  await prisma.doctor.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await hash(adminPassword);

  await prisma.user.create({
    data: {
      id: 'u1',
      name: adminName,
      phone: adminPhone,
      passwordHash,
      role: 'admin',
    },
  });

  console.log(`🌱  Super admin created successully: ${adminPhone}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
