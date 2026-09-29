import { Injectable, NotFoundException } from '@nestjs/common';
import { LeadsRepository } from './leads.repository';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { Prisma } from '@prisma/client';
import { LeadsQueryDto } from './dto/leads-query.dto';
import { orderByOption } from '../common/dto/pagination.dto';
import { tashkentInstantRange } from '../common/utils/date.util';

@Injectable()
export class LeadsService {
  constructor(
    private readonly leadsRepository: LeadsRepository,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async create(dto: CreateLeadDto) {
    const lead = await this.leadsRepository.create(
      dto as Prisma.LeadCreateInput,
    );
    this.notificationsGateway.sendNewLead(lead);
    return lead;
  }

  async findAll(query: LeadsQueryDto) {
    const { search, startDate, endDate, status, source } = query;
    const pageNum = Number(query.page || 0);
    const take = Number(query.limit || 10);
    const skip = pageNum * take;

    const where: Prisma.LeadWhereInput = {};

    const s = search?.trim();
    if (s) {
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { phone: { contains: s } },
      ];
    }

    if (status && status !== 'all') where.status = status;
    if (source) where.source = source;

    if (startDate || endDate) {
      // created_at is a timestamp → whole Asia/Tashkent days.
      where.createdAt = tashkentInstantRange(startDate, endDate);
    }

    return this.leadsRepository.findAll({
      skip,
      take,
      where,
      ...orderByOption<Prisma.LeadOrderByWithRelationInput[]>(
        query,
        'createdAt',
      ),
    });
  }

  async findOne(id: string) {
    const lead = await this.leadsRepository.findById(id);
    if (!lead) throw new NotFoundException('Murojaat topilmadi');
    return lead;
  }

  async update(id: string, dto: UpdateLeadDto) {
    const lead = await this.leadsRepository.findById(id);
    if (!lead) throw new NotFoundException('Murojaat topilmadi');
    return this.leadsRepository.update(id, dto);
  }

  async remove(id: string) {
    const lead = await this.leadsRepository.findById(id);
    if (!lead) throw new NotFoundException('Murojaat topilmadi');
    await this.leadsRepository.delete(id);
    return { success: true };
  }
}
