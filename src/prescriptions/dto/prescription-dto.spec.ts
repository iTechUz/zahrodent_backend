import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  CreatePrescriptionDto,
  PrescriptionItemDto,
} from './create-prescription.dto';
import { PharmacySearchDto } from './pharmacy-search.dto';
import { PrescriptionsQueryDto } from './prescriptions-query.dto';

/** Returns { property: [messages] } for failed validations (nested flattened). */
function errorsOf(cls: new () => object, plain: Record<string, unknown>) {
  const inst = plainToInstance(cls, plain);
  const out: Record<string, string[]> = {};
  const walk = (errs: ReturnType<typeof validateSync>, prefix = '') => {
    for (const e of errs) {
      const key = prefix + e.property;
      if (e.constraints) out[key] = Object.values(e.constraints);
      if (e.children?.length) walk(e.children, `${key}.`);
    }
  };
  walk(validateSync(inst));
  return out;
}

const item = { name: 'Amoksitsillin 500 mg' };

describe('PrescriptionItemDto', () => {
  it('faqat name — to‘g‘ri', () => {
    expect(errorsOf(PrescriptionItemDto, item)).toEqual({});
  });

  it('barcha maydonlar — to‘g‘ri', () => {
    expect(
      errorsOf(PrescriptionItemDto, {
        ...item,
        dosage: '500 mg',
        frequency: 'kuniga 3 mahal',
        duration: '7 kun',
        quantity: '21 dona',
        instructions: 'ovqatdan keyin',
      }),
    ).toEqual({});
  });

  it('name majburiy va bo‘sh bo‘lmasligi kerak', () => {
    expect(errorsOf(PrescriptionItemDto, {})).toHaveProperty('name');
    expect(errorsOf(PrescriptionItemDto, { name: '' })).toHaveProperty('name');
  });

  it('name 200 belgi — o‘tadi, 201 — yiqiladi', () => {
    expect(errorsOf(PrescriptionItemDto, { name: 'a'.repeat(200) })).toEqual(
      {},
    );
    expect(
      errorsOf(PrescriptionItemDto, { name: 'a'.repeat(201) }),
    ).toHaveProperty('name');
  });

  it.each(['dosage', 'frequency', 'duration', 'quantity'])(
    '%s 100 dan oshsa yiqiladi',
    (field) => {
      expect(
        errorsOf(PrescriptionItemDto, { ...item, [field]: 'a'.repeat(100) }),
      ).toEqual({});
      expect(
        errorsOf(PrescriptionItemDto, { ...item, [field]: 'a'.repeat(101) }),
      ).toHaveProperty(field);
    },
  );

  it('instructions 500 dan oshsa yiqiladi', () => {
    expect(
      errorsOf(PrescriptionItemDto, { ...item, instructions: 'a'.repeat(500) }),
    ).toEqual({});
    expect(
      errorsOf(PrescriptionItemDto, { ...item, instructions: 'a'.repeat(501) }),
    ).toHaveProperty('instructions');
  });

  it('string bo‘lmagan qiymatlar rad etiladi', () => {
    expect(errorsOf(PrescriptionItemDto, { name: 5 })).toHaveProperty('name');
    expect(
      errorsOf(PrescriptionItemDto, { ...item, dosage: 500 }),
    ).toHaveProperty('dosage');
  });
});

describe('CreatePrescriptionDto', () => {
  const valid = { patientId: 'p1', items: [item] };

  it('minimal to‘g‘ri', () => {
    expect(errorsOf(CreatePrescriptionDto, valid)).toEqual({});
  });

  it('to‘liq to‘g‘ri', () => {
    expect(
      errorsOf(CreatePrescriptionDto, {
        ...valid,
        doctorId: 'd1',
        visitId: 'v1',
        notes: 'izoh',
        validDays: 30,
      }),
    ).toEqual({});
  });

  it('patientId majburiy / bo‘sh emas', () => {
    expect(errorsOf(CreatePrescriptionDto, { items: [item] })).toHaveProperty(
      'patientId',
    );
    expect(
      errorsOf(CreatePrescriptionDto, { ...valid, patientId: '' }),
    ).toHaveProperty('patientId');
  });

  it('items majburiy, bo‘sh bo‘lmasligi kerak', () => {
    expect(errorsOf(CreatePrescriptionDto, { patientId: 'p1' })).toHaveProperty(
      'items',
    );
    expect(
      errorsOf(CreatePrescriptionDto, { ...valid, items: [] }),
    ).toHaveProperty('items');
    expect(
      errorsOf(CreatePrescriptionDto, { ...valid, items: 'x' }),
    ).toHaveProperty('items');
  });

  it('items maksimum 30', () => {
    const many = (n: number) => Array.from({ length: n }, () => item);
    expect(
      errorsOf(CreatePrescriptionDto, { ...valid, items: many(30) }),
    ).toEqual({});
    expect(
      errorsOf(CreatePrescriptionDto, { ...valid, items: many(31) }),
    ).toHaveProperty('items');
  });

  it('ichki element validatsiyasi (items.1.name)', () => {
    const errs = errorsOf(CreatePrescriptionDto, {
      ...valid,
      items: [item, { name: '' }],
    });
    expect(errs).toHaveProperty(['items.1.name']);
    expect(errs).not.toHaveProperty(['items.0.name']);
  });

  it('notes 1000 belgigacha', () => {
    expect(
      errorsOf(CreatePrescriptionDto, { ...valid, notes: 'a'.repeat(1000) }),
    ).toEqual({});
    expect(
      errorsOf(CreatePrescriptionDto, { ...valid, notes: 'a'.repeat(1001) }),
    ).toHaveProperty('notes');
  });

  it.each([1, 90, '30'])(
    'validDays=%s — to‘g‘ri (satr songa aylanadi)',
    (v) => {
      expect(
        errorsOf(CreatePrescriptionDto, { ...valid, validDays: v }),
      ).toEqual({});
    },
  );

  it.each([0, 91, -1, 1.5, 'abc'])('validDays=%s — noto‘g‘ri', (v) => {
    expect(
      errorsOf(CreatePrescriptionDto, { ...valid, validDays: v }),
    ).toHaveProperty('validDays');
  });
});

describe('PharmacySearchDto', () => {
  it('to‘g‘ri kod va telefon', () => {
    expect(errorsOf(PharmacySearchDto, { q: 'K7M2X9QD' })).toEqual({});
    expect(errorsOf(PharmacySearchDto, { q: '+998901234567' })).toEqual({});
  });

  it('q majburiy', () => {
    expect(errorsOf(PharmacySearchDto, {})).toHaveProperty('q');
  });

  it('chegaralar: 4 va 30 belgi', () => {
    expect(errorsOf(PharmacySearchDto, { q: 'abc' })).toHaveProperty('q');
    expect(errorsOf(PharmacySearchDto, { q: 'abcd' })).toEqual({});
    expect(errorsOf(PharmacySearchDto, { q: 'a'.repeat(30) })).toEqual({});
    expect(errorsOf(PharmacySearchDto, { q: 'a'.repeat(31) })).toHaveProperty(
      'q',
    );
  });

  it('string bo‘lmasa rad etiladi', () => {
    expect(errorsOf(PharmacySearchDto, { q: 12345678 })).toHaveProperty('q');
  });
});

describe('PrescriptionsQueryDto', () => {
  it('bo‘sh query — to‘g‘ri', () => {
    expect(errorsOf(PrescriptionsQueryDto, {})).toEqual({});
  });

  it.each(['issued', 'dispensed', 'cancelled', 'all'])(
    'status=%s — to‘g‘ri',
    (status) => {
      expect(errorsOf(PrescriptionsQueryDto, { status })).toEqual({});
    },
  );

  it('noma‘lum status rad etiladi', () => {
    expect(
      errorsOf(PrescriptionsQueryDto, { status: 'expired' }),
    ).toHaveProperty('status');
  });

  it('patientId va meros olingan order/pagination', () => {
    expect(
      errorsOf(PrescriptionsQueryDto, {
        patientId: 'p1',
        order: 'desc',
        page: '1',
        limit: '20',
      }),
    ).toEqual({});
    expect(
      errorsOf(PrescriptionsQueryDto, { order: 'sideways' }),
    ).toHaveProperty('order');
    expect(errorsOf(PrescriptionsQueryDto, { patientId: 5 })).toHaveProperty(
      'patientId',
    );
  });
});
