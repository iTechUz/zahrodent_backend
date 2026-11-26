import { BadRequestException } from '@nestjs/common';
import {
  AVATAR_MAX_BYTES,
  AVATAR_SIZE_MESSAGE,
  AVATAR_TYPE_MESSAGE,
  sniffImageMime,
  validateAvatarFile,
} from './image-validation';

const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
const webp = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([1, 2, 3, 4]),
  Buffer.from('WEBPVP8 '),
]);

describe('validateAvatarFile', () => {
  it('detects JPG, PNG and WEBP by content', () => {
    expect(sniffImageMime(jpg)).toBe('image/jpeg');
    expect(sniffImageMime(png)).toBe('image/png');
    expect(sniffImageMime(webp)).toBe('image/webp');
    expect(validateAvatarFile({ buffer: webp })).toEqual({
      mime: 'image/webp',
      ext: 'webp',
    });
  });

  it('rejects other formats even when the name says .jpg (GIF, SVG, text)', () => {
    for (const b of [Buffer.from('GIF89a....'), Buffer.from('<svg></svg>')]) {
      expect(() => validateAvatarFile({ buffer: b })).toThrow(
        new BadRequestException(AVATAR_TYPE_MESSAGE),
      );
    }
  });

  it('rejects a missing file and files over 3 MB', () => {
    expect(() => validateAvatarFile(undefined)).toThrow(BadRequestException);
    const big = Buffer.concat([jpg, Buffer.alloc(AVATAR_MAX_BYTES)]);
    expect(() => validateAvatarFile({ buffer: big })).toThrow(
      new BadRequestException(AVATAR_SIZE_MESSAGE),
    );
  });
});
