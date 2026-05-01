import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { LeadsRepository } from './leads.repository';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class LeadsService {
  constructor(
    private readonly leadsRepository: LeadsRepository,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly prisma: PrismaService,
  ) {}

  async create(dto: CreateLeadDto) {
    const lead = await this.leadsRepository.create(dto as Prisma.LeadCreateInput);
    this.notificationsGateway.sendNewLead(lead);
    return lead;
  }

  async findAll(query: any) {
    const { page = 0, limit = 10, search, startDate, endDate, status } = query;
    const skip = Number(page) * Number(limit);
    const take = Number(limit);

    const where: any = {};
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }
    
    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    return this.leadsRepository.findAll({ skip, take, where });
  }

  async findOne(id: string) {
    const lead = await this.leadsRepository.findById(id);
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  async update(id: string, dto: UpdateLeadDto) {
    const lead = await this.leadsRepository.findById(id);
    if (!lead) throw new NotFoundException('Lead not found');
    return this.leadsRepository.update(id, dto);
  }

  async convertToPatient(id: string, branchId: string) {
    const lead = await this.leadsRepository.findById(id);
    if (!lead) throw new NotFoundException('Lead not found');
    if (lead.patientId) throw new ConflictException('Bu lead allaqachon bemorga aylantirilgan');

    return this.prisma.$transaction(async (tx) => {
      // 1. Create patient
      const names = lead.name.split(' ');
      const firstName = names[0];
      const lastName = names.slice(1).join(' ') || '—';

      const patient = await tx.patient.create({
        data: {
          firstName,
          lastName,
          phone: lead.phone,
          branchId,
          source: lead.source || 'TELEGRAM',
          notes: lead.notes || lead.message,
        },
      });

      // 2. Update lead status and link to patient
      await tx.lead.update({
        where: { id },
        data: {
          status: 'converted',
          patientId: patient.id,
        },
      });

      return patient;
    });
  }

  async remove(id: string) {
    const lead = await this.leadsRepository.findById(id);
    if (!lead) throw new NotFoundException('Lead not found');
    await this.leadsRepository.delete(id);
    return { success: true };
  }
}
