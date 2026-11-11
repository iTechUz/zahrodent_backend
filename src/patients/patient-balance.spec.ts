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

  it('EXPENSE (klinika chiqimi) balansga ta’sir qilmaydi, totalRefunded faqat ma’lumot', () => {
    const f = computePatientFinance({
      payments: [pay(200), pay(80, 'paid', 'EXPENSE')],
      visits: [{ price: 100 }],
    });
    expect(f.totalPaid).toBe(200);
    expect(f.totalRefunded).toBe(80);
    expect(f.balance).toBe(200 - 100);
  });

  it('faqat EXPENSE bo‘lgan bemor qarzdor bo‘lib qolmaydi', () => {
    const f = computePatientFinance({
      payments: [pay(80, 'paid', 'EXPENSE'), pay(30, 'paid', 'EXPENSE', 999)],
    });
    expect(f.totalDiscount).toBe(0);
    expect(f.balance).toBe(0);
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
  it('EXPENSE va bemorsiz to‘lovlar SQL dan chiqarib tashlanadi', () => {
    expect(text).toContain(
      "WHERE patient_id IS NOT NULL AND type <> 'EXPENSE'",
    );
    expect(text).toContain(
      "SUM(CASE WHEN status IN ('paid', 'partial') THEN amount ELSE 0 END)",
    );
    expect(text).not.toContain('-amount');
    expect(text).toContain("WHERE status = 'completed'");
  });
});
