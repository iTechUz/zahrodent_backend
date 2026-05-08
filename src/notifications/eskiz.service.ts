import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class EskizService {
  private readonly logger = new Logger(EskizService.name);
  private accessTokens = new Map<string, string>(); // branchId -> token
  private readonly timeoutMs = Number.parseInt(
    process.env.ESKIZ_HTTP_TIMEOUT_MS || '8000',
    10,
  );

  constructor(private readonly prisma: PrismaService) {}

  private get baseUrl(): string {
    return (
      process.env.ESKIZ_BASE_URL?.trim() || 'https://notify.eskiz.uz'
    ).replace(/\/$/, '');
  }

  private get senderFrom(): string {
    return process.env.ESKIZ_FROM?.trim() || '4546';
  }

  async isConfigured(branchId: string): Promise<boolean> {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { eskizEmail: true, eskizToken: true, eskizEnabled: true },
    });
    return Boolean(branch?.eskizEnabled && branch?.eskizEmail && branch?.eskizToken);
  }

  normalizeMobile(phone: string): string | null {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('998')) return digits;
    if (digits.length === 9 && digits.startsWith('9')) return `998${digits}`;
    return null;
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  private async login(branchId: string): Promise<string> {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { eskizEmail: true, eskizToken: true, name: true },
    });
    
    if (!branch || !branch.eskizEmail || !branch.eskizToken) {
      throw new Error('Eskiz branch sozlanmagan');
    }

    const email = branch.eskizEmail.trim();
    const password = branch.eskizToken.trim();

    const res = await this.fetchWithTimeout(`${this.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    const raw = await res.text();
    if (!res.ok) {
      this.logger.warn(`Eskiz login xato (${branch.name}): ${res.status} ${raw.slice(0, 200)}`);
      throw new Error(`Eskiz login: HTTP ${res.status}`);
    }
    let json: { data?: { token?: string }; token?: string };
    try {
      json = JSON.parse(raw) as { data?: { token?: string }; token?: string };
    } catch {
      throw new Error('Eskiz login: noto‘g‘ri JSON');
    }
    const token = json?.data?.token ?? json?.token;
    if (!token) {
      throw new Error('Eskiz login: token topilmadi');
    }
    this.accessTokens.set(branchId, token);
    return token;
  }

  private async getToken(branchId: string): Promise<string> {
    const cached = this.accessTokens.get(branchId);
    if (cached) return cached;
    return this.login(branchId);
  }

  async sendSms(
    branchId: string,
    mobilePhone: string,
    message: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    const isConf = await this.isConfigured(branchId);
    if (!isConf) {
      return { ok: false, error: 'Eskiz ushbu filial uchun sozlanmagan yoki o\'chirilgan' };
    }
    const attempt = async (
      retryOn401: boolean,
    ): Promise<{ ok: true } | { ok: false; error: string }> => {
      let token: string;
      try {
        token = await this.getToken(branchId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, error: msg };
      }
      const res = await this.fetchWithTimeout(
        `${this.baseUrl}/api/message/sms/send`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            mobile_phone: mobilePhone,
            message,
            from: this.senderFrom,
          }),
        },
      );
      if (res.status === 401 && retryOn401) {
        this.accessTokens.delete(branchId);
        return attempt(false);
      }
      const raw = await res.text();
      if (!res.ok) {
        this.logger.warn(`Eskiz SMS xato (Branch ${branchId}): ${res.status} ${raw.slice(0, 300)}`);
        return { ok: false, error: `HTTP ${res.status}: ${raw.slice(0, 200)}` };
      }
      return { ok: true };
    };
    return attempt(true);
  }
}
