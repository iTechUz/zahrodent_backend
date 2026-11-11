import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateDoctorDto } from './create-doctor.dto';
import { UpdateDoctorDto } from './update-doctor.dto';
import { DoctorsQueryDto } from './doctors-query.dto';

const slot = (extra: Record<string, unknown> = {}) => ({
  day: 0,
  startTime: '09:00',
  endTime: '18:00',
  isWorking: true,
  ...extra,
});
const errs = (cls: any, o: object) =>
  validate(plainToInstance(cls, o)).then((e) => e.map((x) => x.property));

describe('Doctor DTO', () => {
  it('eski jadval (tanaffussiz) o‘tadi; tanaffusli ham', async () => {
    await expect(
      errs(UpdateDoctorDto, { schedule: [slot()] }),
    ).resolves.toEqual([]);
    await expect(
      errs(UpdateDoctorDto, {
        schedule: [slot({ breakStart: '13:00', breakEnd: '14:00' })],
      }),
    ).resolves.toEqual([]);
  });

  it('noto‘g‘ri tanaffus formati rad etiladi', async () => {
    await expect(
      errs(UpdateDoctorDto, { schedule: [slot({ breakStart: '1pm' })] }),
    ).resolves.toContain('schedule');
  });

  it('daysOff: [] validatsiyadan o‘tadi', async () => {
    await expect(errs(UpdateDoctorDto, { daysOff: [] })).resolves.toEqual([]);
  });

  it('isActive faqat boolean; loginPhone formati', async () => {
    await expect(errs(UpdateDoctorDto, { isActive: false })).resolves.toEqual(
      [],
    );
    await expect(errs(UpdateDoctorDto, { isActive: 'no' })).resolves.toContain(
      'isActive',
    );
    await expect(
      errs(UpdateDoctorDto, { loginPhone: '123' }),
    ).resolves.toContain('loginPhone');
    await expect(
      errs(UpdateDoctorDto, { loginPhone: '+998901234567' }),
    ).resolves.toEqual([]);
  });

  it('CreateDoctorDto isActive qabul qilmaydi (turi yo‘q) — loginPhone ixtiyoriy', async () => {
    const base = {
      firstName: 'A',
      lastName: 'B',
      specialty: 'S',
      phone: '+998901234567',
    };
    await expect(errs(CreateDoctorDto, base)).resolves.toEqual([]);
    await expect(
      errs(CreateDoctorDto, { ...base, loginPhone: '+998907654321' }),
    ).resolves.toEqual([]);
  });

  it('includeInactive faqat true/false', async () => {
    await expect(
      errs(DoctorsQueryDto, { includeInactive: 'true' }),
    ).resolves.toEqual([]);
    await expect(
      errs(DoctorsQueryDto, { includeInactive: 'x' }),
    ).resolves.toContain('includeInactive');
  });
});
