import {
  computePatientBalance,
  computePatientFinance,
  debtorBalancesSql,
} from './patient-balance';

const pay = (
  amount: number,
  status = 'paid',
  type = 'INCOME',
  discount: number | null = null,
) => ({ amount, status, type, discount });

describe('computePatientFinance', () => {
  it('INCOME paid|partial + chegirma − completed visits', () => {
    const f = computePatientFinance({
      payments: [
        pay(100, 'paid', 'INCOME', 10),
        pay(50, 'partial'),
        pay(70, 'unpaid', 'INCOME', 5),
      ],
      visits: [{ price: 120 }],
    });
    expect(f).toEqual({
      totalPaid: 150,
      totalRefunded: 0,
      totalDiscount: 15,
      totalOwed: 120,
      balance: 45,
    });
  });

  it('EXPENSE (qaytarish) kreditni kamaytiradi, totalPaid faqat INCOME', () => {
    const f = computePatientFinance({
      payments: [pay(200), pay(80, 'paid', 'EXPENSE')],
      visits: [{ price: 100 }],
    });
    expect(f.totalPaid).toBe(200);
    expect(f.totalRefunded).toBe(80);
    expect(f.balance).toBe(200 - 80 - 100);
  });

  it('yig‘ilmagan (unpaid) EXPENSE va EXPENSE chegirmasi hisobga olinmaydi', () => {
    const f = computePatientFinance({
      payments: [pay(80, 'unpaid', 'EXPENSE'), pay(30, 'paid', 'EXPENSE', 999)],
    });
    expect(f.totalRefunded).toBe(30);
    expect(f.totalDiscount).toBe(0);
    expect(f.balance).toBe(-30);
  });

  it('type berilmasa INCOME deb hisoblanadi; bo‘sh manba — 0', () => {
    expect(
      computePatientBalance({
        payments: [{ amount: 10, status: 'paid', discount: null }],
      }),
    ).toBe(10);
    expect(computePatientBalance({})).toBe(0);
  });
});

describe('debtorBalancesSql (computePatientFinance bilan sinxron)', () => {
  const text = debtorBalancesSql.strings.join('?');
  it('EXPENSE kreditdan ayriladi, chegirma faqat INCOME uchun', () => {
    expect(text).toContain(
      "WHEN type = 'EXPENSE' AND status IN ('paid', 'partial') THEN -amount",
    );
    expect(text).toContain(
      "WHEN type <> 'EXPENSE' AND status IN ('paid', 'partial') THEN amount",
    );
    expect(text).toContain(
      "SUM(CASE WHEN type <> 'EXPENSE' THEN COALESCE(discount, 0) ELSE 0 END)",
    );
    expect(text).toContain("WHERE status = 'completed'");
  });
});
