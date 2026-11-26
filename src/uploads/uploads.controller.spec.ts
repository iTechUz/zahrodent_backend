import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UploadsController } from './uploads.controller';

const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);

describe('UploadsController', () => {
  const cdn = { putImage: jest.fn().mockResolvedValue('https://cdn/x.jpg') };
  const prisma = {
    doctor: { update: jest.fn().mockReturnValue('d') },
    user: { update: jest.fn().mockReturnValue('u') },
    $transaction: jest.fn().mockResolvedValue([]),
  };
  const ctrl = new UploadsController(cdn as any, prisma as any);
  beforeEach(() => jest.clearAllMocks());

  it('uploadAvatar validates and returns the CDN url', async () => {
    await expect(
      ctrl.uploadAvatar({ buffer: jpg } as Express.Multer.File),
    ).resolves.toEqual({ url: 'https://cdn/x.jpg' });
    expect(cdn.putImage).toHaveBeenCalledWith(jpg, 'image/jpeg', 'jpg');
  });

  it('uploadAvatar rejects a non-image without touching the CDN', async () => {
    await expect(
      ctrl.uploadAvatar({
        buffer: Buffer.from('hello'),
      } as Express.Multer.File),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(cdn.putImage).not.toHaveBeenCalled();
  });

  it('uploadOwnAvatar saves the url on the doctor and its user account', async () => {
    const user = { id: 'u1', doctorId: 'd1' } as any;
    await expect(
      ctrl.uploadOwnAvatar({ buffer: jpg } as Express.Multer.File, user),
    ).resolves.toEqual({ url: 'https://cdn/x.jpg' });
    expect(prisma.doctor.update).toHaveBeenCalledWith({
      where: { id: 'd1' },
      data: { avatar: 'https://cdn/x.jpg' },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { avatar: 'https://cdn/x.jpg' },
    });
  });

  it('uploadOwnAvatar needs a linked doctor profile', async () => {
    await expect(
      ctrl.uploadOwnAvatar(
        { buffer: jpg } as Express.Multer.File,
        { id: 'u1' } as any,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(cdn.putImage).not.toHaveBeenCalled();
  });
});
