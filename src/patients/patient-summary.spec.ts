import {
  connectActivePatient,
  PATIENT_SUMMARY_SELECT,
  toPatientSummary,
  WITH_PATIENT_SUMMARY,
} from './patient-summary';

describe('patient-summary', () => {
  it('select — faqat ism, familiya, deletedAt', () => {
    expect(PATIENT_SUMMARY_SELECT).toEqual({
      firstName: true,
      lastName: true,
      deletedAt: true,
    });
    expect(WITH_PATIENT_SUMMARY).toEqual({
      patient: { select: PATIENT_SUMMARY_SELECT },
    });
  });

  it('toPatientSummary — o‘chirilgan bemor nomi saqlanadi, deletedAt ISO', () => {
    expect(
      toPatientSummary({
        firstName: 'Ali',
        lastName: 'Valiyev',
        deletedAt: new Date('2026-07-01T10:00:00.000Z'),
      }),
    ).toEqual({
      firstName: 'Ali',
      lastName: 'Valiyev',
      deletedAt: '2026-07-01T10:00:00.000Z',
    });
    expect(
      toPatientSummary({ firstName: 'A', lastName: 'B', deletedAt: null }),
    ).toEqual({ firstName: 'A', lastName: 'B', deletedAt: null });
  });

  it('toPatientSummary — yuklanmagan bo‘lsa undefined', () => {
    expect(toPatientSummary(undefined)).toBeUndefined();
    expect(toPatientSummary(null)).toBeUndefined();
  });

  it('connectActivePatient — o‘chirilgan bemorga bog‘lab bo‘lmaydi (P2025 → 404)', () => {
    expect(connectActivePatient('p1')).toEqual({
      connect: { id: 'p1', deletedAt: null },
    });
  });
});
