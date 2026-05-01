import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { LeadsRepository } from './leads.repository';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { ClsService } from 'nestjs-cls';
import { AuthUserView } from '../auth/auth.service';

@Injectable()
export class LeadsService {
  constructor(
    private readonly leadsRepository: LeadsRepository,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async create(dto: CreateLeadDto) {
    const branchId = dto.branchId || this.cls.get('branchId');
    const lead = await this.leadsRepository.create({
      ...dto,
      branchId,
    } as any);
    this.notificationsGateway.sendNewLead(lead);
    return lead;
  }

  async findAll(query: any, user: AuthUserView) {
    const { page = 0, limit = 10, search, startDate, endDate, status, branchId: queryBranchId } = query;
    const skip = Number(page) * Number(limit);
    const take = Number(limit);

    const where: any = {};
    
    // SaaS Isolation: Admin faqat o'z filialini ko'radi
    if (user.role !== UserRole.SUPER_ADMIN) {
      where.branchId = user.branchId;
    } else if (queryBranchId) {
      where.branchId = queryBranchId;
    }

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

  async findOne(id: string, user: AuthUserView) {
    const lead = await this.leadsRepository.findById(id);
    if (!lead) throw new NotFoundException('Lead not found');

    // SaaS Isolation check
    if (user.role !== UserRole.SUPER_ADMIN && lead.branchId !== user.branchId) {
      throw new ForbiddenException('Sizda ushbu murojaatni ko\'rishga ruxsat yo\'q');
    }

    return lead;
  }

  async update(id: string, dto: UpdateLeadDto, user: AuthUserView) {
    await this.findOne(id, user); // Check access
    return this.leadsRepository.update(id, dto);
  }

  async convertToPatient(id: string, branchId: string, user: AuthUserView) {
    const lead = await this.findOne(id, user); // Check access
    
    // Safety: Admin faqat o'z filialiga aylantira oladi
    const targetBranchId = user.role === UserRole.SUPER_ADMIN ? branchId : user.branchId;

    if (lead.patientId) throw new ConflictException('Bu lead allaqachon bemorga aylantirilgan');

    return this.prisma.$transaction(async (tx) => {
      const names = lead.name.split(' ');
      const firstName = names[0];
      const lastName = names.slice(1).join(' ') || '—';

      const patient = await tx.patient.create({
        data: {
          firstName,
          lastName,
          phone: lead.phone,
          branchId: targetBranchId,
          source: lead.source || 'TELEGRAM',
          notes: lead.notes || lead.message,
        },
      });

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

  async remove(id: string, user: AuthUserView) {
    await this.findOne(id, user); // Check access
    await this.leadsRepository.delete(id);
    return { success: true };
  }
}
