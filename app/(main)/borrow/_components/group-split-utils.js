// Compute how a group expense amount is divided among members based on the
// chosen split type ("equal", "percentage", or exact amounts). Returns an
// array of { id, name, amount } with amounts rounded to 2 decimal places.
export function calculateSplits(amount, splitType, splits, members) {
  if (!amount || !members?.length) return [];

  if (splitType === "equal") {
    const equalShare = parseFloat(amount) / members.length;
    return members.map((member) => ({
      id: member.id,
      name: member.name,
      amount: parseFloat(equalShare.toFixed(2)), // Round to 2 decimal places
    }));
  }

  if (splitType === "percentage") {
    return splits.map((split) => ({
      id: split.id,
      name: members.find((m) => m.id === split.id)?.name,
      amount: parseFloat(
        ((parseFloat(amount) * parseFloat(split.value)) / 100).toFixed(2)
      ),
    }));
  }

  // For exact amounts
  return splits.map((split) => ({
    id: split.id,
    name: members.find((m) => m.id === split.id)?.name,
    amount: parseFloat(parseFloat(split.value).toFixed(2)),
  }));
}
