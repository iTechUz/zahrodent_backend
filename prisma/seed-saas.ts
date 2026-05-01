import { PrismaClient, UserRole, SubscriptionStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seed boshlanmoqda...');

  // 1. Tariflarni yaratish (agar yo'q bo'lsa)
  const standardPlan = await prisma.subscriptionPlan.upsert({
    where: { id: 'standard-id' },
    update: {},
    create: {
      id: 'standard-id',
      name: 'Standard Plan',
      price: 300000,
      features: ['5 ta xodim', 'Bemorlar bazasi', 'SMS xabarnomalar (Cheklangan)'],
      isPopular: false,
    },
  });

  const premiumPlan = await prisma.subscriptionPlan.upsert({
    where: { id: 'premium-id' },
    update: {},
    create: {
      id: 'premium-id',
      name: 'Premium Plan',
      price: 500000,
      features: ['Cheksiz xodimlar', 'Buxgalteriya', 'Telegram Bot integratsiyasi', 'Premium Yordam'],
      isPopular: true,
    },
  });

  console.log('Tariflar tayyor.');

  const passwordHash = await bcrypt.hash('password123', 10);

  // 2. 3 ta klinika qo'shish
  const clinics = [
    {
      name: 'Zahro Dental Main',
      address: 'Toshkent, Chilonzor 5-mavze',
      phone: '+998901234567',
      planId: premiumPlan.id,
      admin: { name: 'Asror Vali', phone: '998901234567' }
    },
    {
      name: 'Grand Smile Clinic',
      address: 'Toshkent, Yunusobod 10-mavze',
      phone: '+998935554433',
      planId: standardPlan.id,
      admin: { name: 'Bekzod Sharipov', phone: '998935554433' }
    },
    {
      name: 'Elite Dental Center',
      address: 'Samarqand, Registon ko\'chasi',
      phone: '+998941112233',
      planId: standardPlan.id,
      admin: { name: 'Jamshid Karimov', phone: '998941112233' }
    }
  ];

  for (const clinicData of clinics) {
    // Filial yaratish
    const branch = await prisma.branch.create({
      data: {
        name: clinicData.name,
        address: clinicData.address,
        phone: clinicData.phone,
        isActive: true,
      }
    });

    // Obunani biriktirish
    await prisma.branchSubscription.create({
      data: {
        branchId: branch.id,
        planId: clinicData.planId,
        status: SubscriptionStatus.ACTIVE,
        startDate: new Date(),
        endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)), // 1 oylik
      }
    });

    // Admin user yaratish
    await prisma.user.create({
      data: {
        branchId: branch.id,
        name: clinicData.admin.name,
        phone: clinicData.admin.phone,
        passwordHash: passwordHash,
        role: UserRole.ADMIN,
        isActive: true,
      }
    });

    console.log(`Klinika qo'shildi: ${clinicData.name}`);
  }

  console.log('Seed muvaffaqiyatli yakunlandi.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
