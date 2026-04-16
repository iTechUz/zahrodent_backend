import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const hash = (plain: string) => bcrypt.hash(plain, 10);

  await prisma.user.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.visit.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.service.deleteMany();
  await prisma.doctor.deleteMany();
  await prisma.patient.deleteMany();

  const users = [
    { id: 'u1', name: 'Dr. Zahro Admin', phone: '+998901234567', password: 'admin123', role: 'admin' },
    { id: 'u2', name: 'Dr. Kamila Usmanova', phone: '+998901112233', password: 'doctor123', role: 'doctor', specialty: 'Umumiy stomatologiya' },
    { id: 'u3', name: 'Dr. Farrukh Ismoilov', phone: '+998912223344', password: 'doctor123', role: 'doctor', specialty: 'Ortodontiya' },
    { id: 'u4', name: 'Gulnora Qabulxona', phone: '+998901234568', password: 'reception123', role: 'receptionist' },
    { id: 'u5', name: 'Madina Qabulxona', phone: '+998901234569', password: 'reception123', role: 'receptionist' },
  ];

  for (const u of users) {
    await prisma.user.create({
      data: {
        id: u.id,
        name: u.name,
        phone: u.phone,
        passwordHash: await hash(u.password),
        role: u.role,
        specialty: 'specialty' in u ? (u as any).specialty : null,
      },
    });
  }

  await prisma.patient.create({
    data: {
      id: 'p1',
      firstName: 'Oisha',
      lastName: 'Karimova',
      age: 28,
      phone: '+998 90 123 4567',
      source: 'telegram',
      notes: 'Muntazam tekshiruv bemori',
      createdAt: new Date('2024-01-15'),
      allergies: 'Lidokain',
      bloodType: 'A+',
      toothChart: {
        '16': { toothNumber: 16, condition: 'filled', notes: 'Kompozit plomba', date: '2024-01-15' },
        '26': { toothNumber: 26, condition: 'cavity', notes: 'Kichik kariyes', date: '2024-03-31' },
      },
    },
  });

  await prisma.patient.create({
    data: {
      id: 'p2',
      firstName: 'Rustam',
      lastName: 'Aliyev',
      age: 35,
      phone: '+998 91 234 5678',
      source: 'walk-in',
      notes: 'Pastki chap tishda sezuvchanlik',
      createdAt: new Date('2024-02-20'),
      bloodType: 'B+',
    },
  });

  await prisma.doctor.create({
    data: {
      id: 'd1',
      name: 'Dr. Kamila Usmanova',
      specialty: 'Umumiy stomatologiya',
      phone: '+998 90 111 2233',
      workingHours: 'Du-Ju 9:00-17:00',
      schedule: [
        { day: 0, startTime: '09:00', endTime: '17:00', isWorking: true },
        { day: 1, startTime: '09:00', endTime: '17:00', isWorking: true },
        { day: 2, startTime: '09:00', endTime: '17:00', isWorking: true },
        { day: 3, startTime: '09:00', endTime: '17:00', isWorking: true },
        { day: 4, startTime: '09:00', endTime: '17:00', isWorking: true },
        { day: 5, startTime: '00:00', endTime: '00:00', isWorking: false },
        { day: 6, startTime: '00:00', endTime: '00:00', isWorking: false },
      ],
    },
  });

  await prisma.doctor.create({
    data: {
      id: 'd2',
      name: 'Dr. Farrukh Ismoilov',
      specialty: 'Ortodontiya',
      phone: '+998 91 222 3344',
      workingHours: 'Du-Sha 10:00-18:00',
    },
  });

  await prisma.service.create({
    data: {
      id: 's1',
      name: "Umumiy ko'rik",
      category: 'Diagnostika',
      price: 50000,
      duration: 30,
      description: "To'liq og'iz bo'shligi tekshiruvi",
    },
  });

  await prisma.service.create({
    data: {
      id: 's2',
      name: 'Professional tozalash',
      category: 'Profilaktika',
      price: 120000,
      duration: 45,
    },
  });

  await prisma.booking.create({
    data: {
      id: 'b1',
      patientId: 'p1',
      doctorId: 'd1',
      date: new Date('2024-03-31'),
      time: '09:00',
      source: 'telegram',
      status: 'confirmed',
      createdAt: new Date('2024-03-28'),
    },
  });

  await prisma.visit.create({
    data: {
      id: 'v1',
      patientId: 'p1',
      doctorId: 'd1',
      bookingId: 'b1',
      date: new Date('2024-03-31'),
      status: 'completed',
      diagnosis: 'Kichik kariyes',
      treatment: 'Kompozit plomba',
      notes: "6 oydan keyin nazorat",
    },
  });

  await prisma.payment.create({
    data: {
      id: 'pay1',
      patientId: 'p1',
      amount: 150000,
      method: 'card',
      status: 'paid',
      date: new Date('2024-03-31'),
      description: 'Kompozit plomba',
      serviceId: 's1',
    },
  });

  await prisma.notification.create({
    data: {
      id: 'n1',
      patientId: 'p1',
      type: 'telegram',
      message: "Eslatma: Sizning qabulingiz ertaga soat 9:00 da",
      sentAt: new Date('2024-03-30T18:00:00'),
      status: 'delivered',
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
