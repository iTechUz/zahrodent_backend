import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Client } from 'minio';

export const CDN_NOT_CONFIGURED_MESSAGE =
  'Rasm yuklash sozlanmagan (CDN_* muhit o‘zgaruvchilari yo‘q)';

/**
 * Uploads images to the shared MinIO bucket that cdn.rabola.uz serves
 * (public URL = CDN_PUBLIC_URL/<key>). Configured by CDN_ENDPOINT,
 * CDN_ACCESS_KEY, CDN_SECRET_KEY, CDN_BUCKET (+ optional CDN_PORT, CDN_USE_SSL,
 * CDN_PUBLIC_URL, CDN_PREFIX).
 */
@Injectable()
export class CdnStorageService {
  private readonly logger = new Logger(CdnStorageService.name);
  private client?: Client;

  isConfigured(): boolean {
    return !!(
      process.env.CDN_ENDPOINT?.trim() &&
      process.env.CDN_ACCESS_KEY?.trim() &&
      process.env.CDN_SECRET_KEY?.trim() &&
      process.env.CDN_BUCKET?.trim()
    );
  }

  private getClient(): Client {
    if (!this.client) {
      const ssl = (process.env.CDN_USE_SSL ?? 'true') !== 'false';
      this.client = new Client({
        endPoint: process.env.CDN_ENDPOINT!.trim(),
        port: Number(process.env.CDN_PORT) || (ssl ? 443 : 80),
        useSSL: ssl,
        accessKey: process.env.CDN_ACCESS_KEY!.trim(),
        secretKey: process.env.CDN_SECRET_KEY!.trim(),
      });
    }
    return this.client;
  }

  /** Public URL for an object key. */
  publicUrl(key: string): string {
    const bucket = process.env.CDN_BUCKET!.trim();
    const base =
      process.env.CDN_PUBLIC_URL?.trim() ||
      `https://${process.env.CDN_ENDPOINT!.trim()}/${bucket}`;
    return `${base.replace(/\/+$/, '')}/${key}`;
  }

  /** Stores an image under `<prefix>/avatars/<random>.<ext>` and returns its public URL. */
  async putImage(buffer: Buffer, mime: string, ext: string): Promise<string> {
    if (!this.isConfigured())
      throw new ServiceUnavailableException(CDN_NOT_CONFIGURED_MESSAGE);
    const prefix = (process.env.CDN_PREFIX?.trim() || 'zahrodent').replace(
      /^\/+|\/+$/g,
      '',
    );
    const key = `${prefix}/avatars/${Date.now()}-${randomBytes(8).toString('hex')}.${ext}`;
    try {
      await this.getClient().putObject(
        process.env.CDN_BUCKET!.trim(),
        key,
        buffer,
        buffer.length,
        { 'Content-Type': mime, 'Cache-Control': 'public, max-age=31536000' },
      );
    } catch (e) {
      this.logger.error(
        `CDN'ga rasm yuklanmadi: ${e instanceof Error ? e.message : String(e)}`,
      );
      throw new ServiceUnavailableException(
        "Rasmni yuklab bo'lmadi, birozdan keyin qayta urinib ko'ring",
      );
    }
    return this.publicUrl(key);
  }
}
