import { ServiceUnavailableException } from '@nestjs/common';
import { CdnStorageService } from './cdn-storage.service';

const putObject = jest.fn();
jest.mock('minio', () => ({
  Client: jest.fn().mockImplementation(() => ({ putObject })),
}));

const KEYS = [
  'CDN_ENDPOINT',
  'CDN_ACCESS_KEY',
  'CDN_SECRET_KEY',
  'CDN_BUCKET',
  'CDN_PUBLIC_URL',
  'CDN_PREFIX',
];

describe('CdnStorageService', () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    KEYS.forEach((k) => {
      saved[k] = process.env[k];
      delete process.env[k];
    });
    putObject.mockReset();
  });
  afterEach(() =>
    KEYS.forEach((k) => {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }),
  );

  const configure = () => {
    process.env.CDN_ENDPOINT = 'cdn.rabola.uz';
    process.env.CDN_ACCESS_KEY = 'a';
    process.env.CDN_SECRET_KEY = 's';
    process.env.CDN_BUCKET = 'bucket';
  };

  it('503 when the CDN is not configured', async () => {
    const svc = new CdnStorageService();
    expect(svc.isConfigured()).toBe(false);
    await expect(
      svc.putImage(Buffer.from('x'), 'image/png', 'png'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('uploads under <prefix>/avatars and returns the cdn.rabola.uz URL', async () => {
    configure();
    putObject.mockResolvedValue({});
    const url = await new CdnStorageService().putImage(
      Buffer.from('x'),
      'image/png',
      'png',
    );
    expect(url).toMatch(
      /^https:\/\/cdn\.rabola\.uz\/bucket\/zahrodent\/avatars\/\d+-[0-9a-f]{16}\.png$/,
    );
    expect(putObject).toHaveBeenCalledWith(
      'bucket',
      expect.stringMatching(/^zahrodent\/avatars\/.+\.png$/),
      expect.any(Buffer),
      1,
      expect.objectContaining({ 'Content-Type': 'image/png' }),
    );
  });

  it('CDN_PUBLIC_URL overrides the URL base; storage errors become 503', async () => {
    configure();
    process.env.CDN_PUBLIC_URL = 'https://cdn.example/b/';
    putObject.mockResolvedValueOnce({});
    const svc = new CdnStorageService();
    expect(await svc.putImage(Buffer.from('x'), 'image/jpeg', 'jpg')).toMatch(
      /^https:\/\/cdn\.example\/b\/zahrodent\/avatars\//,
    );
    putObject.mockRejectedValueOnce(new Error('boom'));
    await expect(
      svc.putImage(Buffer.from('x'), 'image/jpeg', 'jpg'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
