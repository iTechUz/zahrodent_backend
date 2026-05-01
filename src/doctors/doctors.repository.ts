import { Injectable } from '@nestjs/common';
import { Doctor, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class DoctorsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(where?: Prisma.DoctorWhereInput): Promise<Doctor[]> {
    return this.prisma.doctor.findMany({
      where: { ...where, deletedAt: null },
      include: {
        user: true,
        availabilities: true,
      },
    });
  }

  async findById(id: string): Promise<Doctor | null> {
    return this.prisma.doctor.findUnique({
      where: { id },
      include: {
        user: true,
        availabilities: true,
      },
    });
  }

  async findUserById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async create(data: Prisma.DoctorCreateInput): Promise<Doctor> {
    return this.prisma.doctor.create({
      data,
      include: { user: true, availabilities: true },
    });
  }

  async update(id: string, data: Prisma.DoctorUpdateInput): Promise<Doctor> {
    return this.prisma.doctor.update({
      where: { id },
      data,
      include: { user: true, availabilities: true },
    });
  }

  async softDelete(id: string): Promise<Doctor> {
    return this.prisma.doctor.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }
}
