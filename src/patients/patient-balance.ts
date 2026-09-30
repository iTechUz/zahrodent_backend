import { Prisma } from '@prisma/client';

/**
 * Patient balance (so'm):
 *   credit = Σ INCOME payment amounts with status paid|partial
 *          + Σ INCOME payment discounts (any status)
 *   owed   = Σ price of completed visits
 *   balance = credit − owed   (negative → the patient owes the clinic)
 *
 * EXPENSE payments ("Chiqim") never affect a patient's balance.
 * Keep `debtorBalancesSql` below in sync with this definition.
 */
export const COLLECTED_PAYMENT_STATUSES = ['paid', 'partial'] as const;

export const PATIENT_BALANCE_INCLUDE = {
  payments: {
    where: { type: 'INCOME' },
    select: { amount: true, status: true, discount: true },
  },
  visits: { where: { status: 'completed' }, select: { price: true } },
} satisfies Prisma.PatientInclude;

type BalanceSource = {
  payments?: { amount: number; status: string; discount: number | null }[];
  visits?: { price: number }[];
};

export function computePatientBalance(p: BalanceSource): number {
  const credit = (p.payments ?? []).reduce((acc, pay) => {
    const collected = (
      COLLECTED_PAYMENT_STATUSES as readonly string[]
    ).includes(pay.status)
      ? pay.amount || 0
      : 0;
    return acc + collected + (pay.discount || 0);
  }, 0);
  const owed = (p.visits ?? []).reduce((acc, v) => acc + (v.price || 0), 0);
  return credit - owed;
}

/** SQL twin of computePatientBalance: non-deleted patients with balance < 0. */
export const debtorBalancesSql = Prisma.sql`
  SELECT p.id AS id,
         (COALESCE(pay.credit, 0) - COALESCE(v.owed, 0))::float8 AS balance
  FROM patients p
  LEFT JOIN (
    SELECT patient_id,
           SUM(CASE WHEN status IN ('paid', 'partial') THEN amount ELSE 0 END)
             + SUM(COALESCE(discount, 0)) AS credit
    FROM payments
    WHERE type = 'INCOME'
    GROUP BY patient_id
  ) pay ON pay.patient_id = p.id
  LEFT JOIN (
    SELECT patient_id, SUM(price) AS owed
    FROM visits
    WHERE status = 'completed'
    GROUP BY patient_id
  ) v ON v.patient_id = p.id
  WHERE p.deleted_at IS NULL
    AND COALESCE(pay.credit, 0) - COALESCE(v.owed, 0) < 0
`;

/** Total outstanding debt (Σ −balance of debtors) and number of debtors. */
export const debtSummarySql = Prisma.sql`
  SELECT COALESCE(SUM(-d.balance), 0)::float8 AS total,
         COUNT(*)::int AS count
  FROM (${debtorBalancesSql}) d
`;
