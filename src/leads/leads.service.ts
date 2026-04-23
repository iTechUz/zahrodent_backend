import { Injectable, NotFoundException } from '@nestjs/common';
import { LeadsRepository } from './leads.repository';
import { UpdateLeadDto } from './dto/update-lead.dto';

@Injectable()
export class LeadsService {
  constructor(private readonly leadsRepository: LeadsRepository) {}

  async findAll() {
    return this.leadsRepository.findAll();
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

  async remove(id: string) {
    const lead = await this.leadsRepository.findById(id);
    if (!lead) throw new NotFoundException('Lead not found');
    await this.leadsRepository.delete(id);
    return { success: true };
  }
}
