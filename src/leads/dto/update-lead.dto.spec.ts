import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateLeadDto } from './update-lead.dto';

const errorsFor = (o: object) =>
  validate(plainToInstance(UpdateLeadDto, o)).then((e) =>
    e.map((x) => x.property),
  );

describe('UpdateLeadDto phone', () => {
  it('telefon bo‘lmasa — xato yo‘q', async () => {
    await expect(errorsFor({ status: 'new' })).resolves.toEqual([]);
  });
  it('to‘g‘ri telefon — o‘tadi', async () => {
    await expect(errorsFor({ phone: '+998 90 123-45-67' })).resolves.toEqual(
      [],
    );
  });
  it.each(['abc', '', '12', '+998;DROP'])('%p — rad etiladi', async (phone) => {
    await expect(errorsFor({ phone })).resolves.toContain('phone');
  });
});
