import { getUserAccounts } from "@/actions/dashboard";
import { defaultCategories } from "@/data/categories";
import { AddTransactionForm } from "../_components/transaction-form";
import { getTransaction } from "@/actions/transaction";

// Bulk statement imports run as Server Actions posted to this route and can
// take well over a minute on large statements. Without this they are killed at
// the Vercel plan default (10s Hobby / 15s Pro).
// NOTE: 300 requires a Pro plan; Hobby silently caps at 60.
export const maxDuration = 300;

export default async function AddTransactionPage({ searchParams }) {
  const accounts = await getUserAccounts();
  const editId = (await searchParams)?.edit;

  editId?.edit;

  let initialData = null;
  if (editId) {
    const transaction = await getTransaction(editId);
    initialData = transaction;
  }

  return (
    <div className="max-w-3xl mx-auto px-5">
      <div className="flex justify-center md:justify-normal mb-8">
        <h1 className="text-5xl gradient-title ">Add Transaction</h1>
      </div>
      <AddTransactionForm
        accounts={accounts}
        categories={defaultCategories}
        editMode={!!editId}
        initialData={initialData}
      />
      <div className="py-2"></div>
    </div>
    
  );
}
