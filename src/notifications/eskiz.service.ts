import { Injectable, Logger } from '@nestjs/common';

/** Eskiz.uz — https://eskiz.uz (notify.eskiz.uz API) */
@Injectable()
export class EskizService {
  private readonly logger = new Logger(EskizService.name);
  private accessToken: string | null = null;

  private get baseUrl(): string {
    return (process.env.ESKIZ_BASE_URL?.trim() || 'https://notify.eskiz.uz').replace(
      /\/$/,
      '',
    );
  }

  /** Kabinetdan olingan jo'natuvchi nomi / qisqa raqam (masalan 4546) */
  private get senderFrom(): string {
    return process.env.ESKIZ_FROM?.trim() || '4546';
  }

  isConfigured(): boolean {
    const email = process.env.ESKIZ_EMAIL?.trim();
    const password = process.env.ESKIZ_PASSWORD?.trim();
    return Boolean(email && password);
  }

  /**
   * Raqamni Eskiz talabiga moslashtiradi: faqat raqamlar, 998XXXXXXXXX (12 ta).
   */
  normalizeMobile(phone: string): string | null {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('998')) return digits;
    if (digits.length === 9 && digits.startsWith('9')) return `998${digits}`;
    return null;
  }

  private async login(): Promise<string> {
    const email = process.env.ESKIZ_EMAIL?.trim();
    const password = process.env.ESKIZ_PASSWORD?.trim();
    if (!email || !password) {
      throw new Error('ESKIZ_EMAIL / ESKIZ_PASSWORD sozlanmagan');
    }
    const res = await fetch(`${this.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const raw = await res.text();
    if (!res.ok) {
      this.logger.warn(`Eskiz login xato: ${res.status} ${raw.slice(0, 200)}`);
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
    this.accessToken = token;
    return token;
  }

  private async getToken(): Promise<string> {
    if (this.accessToken) return this.accessToken;
    return this.login();
  }

  /**
   * Bitta SMS yuboradi. `mobile_phone` — 998901234567 formatida.
   */
  async sendSms(
    mobilePhone: string,
    message: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!this.isConfigured()) {
      return { ok: false, error: 'Eskiz sozlanmagan' };
    }
    const attempt = async (retryOn401: boolean): Promise<{ ok: true } | { ok: false; error: string }> => {
      let token: string;
      try {
        token = await this.getToken();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, error: msg };
      }
      const res = await fetch(`${this.baseUrl}/api/message/sms/send`, {
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
      });
      if (res.status === 401 && retryOn401) {
        this.accessToken = null;
        return attempt(false);
      }
      const raw = await res.text();
      if (!res.ok) {
        this.logger.warn(`Eskiz SMS xato: ${res.status} ${raw.slice(0, 300)}`);
        return { ok: false, error: `HTTP ${res.status}: ${raw.slice(0, 200)}` };
      }
      return { ok: true };
    };
    return attempt(true);
  }
}
