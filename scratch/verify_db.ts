import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const p = await prisma.patient.findFirst();
  console.log('PATIENT:', p);
  const d = await prisma.doctor.findFirst();
  console.log('DOCTOR:', d);
}

main().finally(() => prisma.$disconnect());
