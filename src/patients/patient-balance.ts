import { Prisma } from '@prisma/client';

/**
 * Patient balance (so'm):
 *   credit = Σ INCOME payment amounts with status paid|partial
 *          + Σ INCOME payment discounts (any status)
 *   owed   = Σ price of completed visits
 *   balance = credit − owed   (negative → the patient owes the clinic)
 *
 * EXPENSE ("Chiqim") is a CLINIC expense (rent, materials, ...): it never
 * touches any patient's balance or debt, even when an old row happens to be
 * attached to a patient (before `patient_id` became optional every expense
 * had to pick one). `totalRefunded` is kept in the profile as information
 * only (Σ collected EXPENSE attached to the patient) and is NOT subtracted.
 * `totalPaid` is INCOME only. Keep `debtorBalancesSql` below in sync.
 */
export const COLLECTED_PAYMENT_STATUSES = ['paid', 'partial'] as const;

export const PATIENT_BALANCE_INCLUDE = {
  payments: {
    select: { amount: true, status: true, discount: true, type: true },
  },
  visits: { where: { status: 'completed' }, select: { price: true } },
} satisfies Prisma.PatientInclude;

type BalanceSource = {
  payments?: {
    amount: number;
    status: string;
    discount: number | null;
    type?: string;
  }[];
  visits?: { price: number }[];
};

export type PatientFinance = {
  /** INCOME collected (paid|partial) — gross money received. */
  totalPaid: number;
  /** EXPENSE collected (paid|partial) attached to the patient — informational, not in balance. */
  totalRefunded: number;
  /** Σ INCOME discounts. */
  totalDiscount: number;
  /** Σ price of completed visits. */
  totalOwed: number;
  /** totalPaid + totalDiscount − totalOwed (EXPENSE excluded). */
  balance: number;
};

export function computePatientFinance(p: BalanceSource): PatientFinance {
  const collectedStatuses = COLLECTED_PAYMENT_STATUSES as readonly string[];
  let totalPaid = 0;
  let totalRefunded = 0;
  let totalDiscount = 0;
  for (const pay of p.payments ?? []) {
    const collected = collectedStatuses.includes(pay.status)
      ? pay.amount || 0
      : 0;
    if ((pay.type ?? 'INCOME') === 'EXPENSE') {
      totalRefunded += collected;
    } else {
      totalPaid += collected;
      totalDiscount += pay.discount || 0;
    }
  }
  const totalOwed = (p.visits ?? []).reduce(
    (acc, v) => acc + (v.price || 0),
    0,
  );
  return {
    totalPaid,
    totalRefunded,
    totalDiscount,
    totalOwed,
    balance: totalPaid + totalDiscount - totalOwed,
  };
}

export function computePatientBalance(p: BalanceSource): number {
  return computePatientFinance(p).balance;
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
    WHERE patient_id IS NOT NULL AND type <> 'EXPENSE'
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
