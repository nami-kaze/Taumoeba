// Prisma returns Decimal columns as Decimal objects, which cannot be passed
// from Server Actions to Client Components. These helpers convert those Decimal
// fields to plain numbers so the result is serializable.

/**
 * Serialize an object that may have `balance` and/or `amount` Decimal fields.
 * Only fields that are present are converted, leaving the rest untouched.
 */
export const serializeDecimal = (obj) => {
  const serialized = { ...obj };
  if (obj.balance) {
    serialized.balance = obj.balance.toNumber();
  }
  if (obj.amount) {
    serialized.amount = obj.amount.toNumber();
  }
  return serialized;
};

/**
 * Serialize an object with a required `amount` Decimal field to a number.
 */
export const serializeAmount = (obj) => ({
  ...obj,
  amount: obj.amount.toNumber(),
});
