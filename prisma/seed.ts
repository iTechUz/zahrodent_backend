import { PrismaClient, UserRole, BookingStatus, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  console.log('Cleaning database...');
  await prisma.payment.deleteMany();
  await prisma.visit.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.patientComment.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.doctorAvailability.deleteMany();
  await prisma.doctor.deleteMany();
  await prisma.service.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.user.deleteMany();
  await prisma.branch.deleteMany();

  console.log('Creating Branches...');
  const chilonzor = await prisma.branch.create({
    data: {
      name: 'Zahro Dental (Chilonzor)',
      address: 'Chilonzor tumani, 5-kvartal',
      phone: '+998901111111',
    }
  });

  console.log('Creating Users...');
  // Global Super Admin
  await prisma.user.create({
    data: {
      name: 'Super Admin',
      phone: '+998900000000',
      passwordHash,
      role: UserRole.SUPER_ADMIN,
    }
  });

  // Branch Admin
  await prisma.user.create({
    data: {
      name: 'Chilonzor Admin',
      phone: '+998901110001',
      passwordHash,
      role: UserRole.ADMIN,
      branchId: chilonzor.id
    }
  });

  console.log('Creating Services...');
  const service = await prisma.service.create({
    data: {
      name: 'Konsultatsiya',
      basePrice: new Prisma.Decimal(50000),
      duration: 30,
      category: 'Umumiy',
      branchId: chilonzor.id
    }
  });

  console.log('Creating Doctors...');
  const dr1User = await prisma.user.create({
    data: {
      name: 'Dr. Ahmadjonov',
      phone: '+998902222222',
      passwordHash,
      role: UserRole.DOCTOR,
      branchId: chilonzor.id
    }
  });

  const dr1 = await prisma.doctor.create({
    data: {
      userId: dr1User.id,
      specialty: 'Stomatolog-terapevt',
      experienceYears: 10,
    }
  });

  console.log('Creating Patients...');
  const patientUser = await prisma.user.create({
    data: {
      name: 'Abdurahmonov Aziz',
      phone: '+998935555555',
      passwordHash,
      role: UserRole.PATIENT,
      branchId: chilonzor.id
    }
  });

  const patient = await prisma.patient.create({
    data: {
      userId: patientUser.id,
      branchId: chilonzor.id,
      firstName: 'Aziz',
      lastName: 'Abdurahmonov',
      phone: '+998935555555',
      gender: 'Erkak',
      source: 'Instagram',
      assignedDoctorId: dr1.id
    }
  });

  console.log('Creating Bookings, Payments & Visits...');
  const booking = await prisma.booking.create({
    data: {
      patientId: patient.id,
      doctorId: dr1.id,
      branchId: chilonzor.id,
      startTime: new Date(),
      endTime: new Date(Date.now() + 3600000),
      status: BookingStatus.PENDING,
      source: 'Instagram'
    }
  });

  await prisma.payment.create({
    data: {
      patientId: patient.id,
      doctorId: dr1.id,
      branchId: chilonzor.id,
      bookingId: booking.id,
      amount: new Prisma.Decimal(250000),
      status: 'INCOME',
      method: 'CASH',
      date: new Date()
    }
  });

  await prisma.visit.create({
    data: {
      patientId: patient.id,
      doctorId: dr1.id,
      branchId: chilonzor.id,
      bookingId: booking.id,
      diagnosis: 'Tish og\'rig\'i, karies',
      treatment: 'Plomba qo\'yish',
      price: new Prisma.Decimal(250000),
      date: new Date()
    }
  });

  console.log('🌱  Seed complete successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
