import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { LeadsService } from './leads.service';
import { normalizeUzPhone } from '../common/utils/phone.util';

export class PublicLeadDto {
  @IsString() @IsNotEmpty() @MaxLength(100) name: string;
  @IsString()
  @Matches(/^\+?[\d\s()-]{7,20}$/, { message: 'Invalid phone' })
  phone: string;
  @IsOptional() @IsString() @MaxLength(100) service?: string;
  /** Preferred date (YYYY-MM-DD) and the visitor's note, stored together in `message`. */
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date?: string;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
  @IsOptional() @IsString() @MaxLength(100) doctor?: string;
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'time must be HH:mm' })
  time?: string;
  /** Honeypot: hidden in the form, humans leave it empty, bots fill it. */
  @IsOptional() @IsString() @MaxLength(200) website?: string;
}

/** Unauthenticated landing-page form → a `website` lead in the admin funnel. */
@ApiTags('leads')
@Controller('public/leads')
export class PublicLeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Landing sahifadan murojaat (ochiq, throttled)' })
  async create(@Body() dto: PublicLeadDto) {
    // Bot filled the hidden field: pretend success, store nothing.
    if (dto.website) return { ok: true };
    const phone = normalizeUzPhone(dto.phone);
    if (!phone) throw new BadRequestException('phone: Invalid phone');
    const message =
      [dto.date && `Sana: ${dto.date}`, dto.note].filter(Boolean).join('\n') ||
      undefined;
    await this.leadsService.create({
      name: dto.name.trim(),
      phone,
      service: dto.service,
      doctor: dto.doctor?.trim() || undefined,
      preferredAt:
        dto.date && (dto.time ? `${dto.date} ${dto.time}` : dto.date),
      message,
      source: 'website',
    });
    return { ok: true };
  }
}
