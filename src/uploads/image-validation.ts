import { BadRequestException } from '@nestjs/common';

/** Max avatar size (bytes). */
export const AVATAR_MAX_BYTES = 3 * 1024 * 1024;

export const IMAGE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

export type ImageMime = keyof typeof IMAGE_TYPES;

export const AVATAR_TYPE_MESSAGE =
  "Rasm formati JPG, PNG yoki WEBP bo'lishi kerak";
export const AVATAR_SIZE_MESSAGE = 'Rasm hajmi 3 MB dan oshmasligi kerak';
export const AVATAR_MISSING_MESSAGE = 'Rasm fayli yuborilmadi';

/** Real type from the first bytes (the client-declared mimetype is not trusted). */
export function sniffImageMime(buf: Buffer): ImageMime | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
    return 'image/jpeg';
  if (
    buf.length >= 8 &&
    buf
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return 'image/png';
  if (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  )
    return 'image/webp';
  return null;
}

/** Throws 400 unless the file is a JPG/PNG/WEBP within the size limit; returns its real type. */
export function validateAvatarFile(
  file: { buffer?: Buffer; size?: number } | undefined,
): { mime: ImageMime; ext: string } {
  if (!file?.buffer?.length)
    throw new BadRequestException(AVATAR_MISSING_MESSAGE);
  if (file.buffer.length > AVATAR_MAX_BYTES)
    throw new BadRequestException(AVATAR_SIZE_MESSAGE);
  const mime = sniffImageMime(file.buffer);
  if (!mime) throw new BadRequestException(AVATAR_TYPE_MESSAGE);
  return { mime, ext: IMAGE_TYPES[mime] };
}
