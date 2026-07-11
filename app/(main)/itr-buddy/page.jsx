import { getUserAccounts } from "@/actions/dashboard";
import ItrBuddy from "./_components/itr-buddy";

export const metadata = {
  title: "ITR Buddy | Monies",
  description: "Download your transactions as a CSV for tax filing.",
};

export default async function ItrBuddyPage() {
  const accounts = (await getUserAccounts()) || [];

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-5xl md:text-6xl font-bold gradient-title">
          ITR Buddy
        </h1>
        <p className="text-muted-foreground mt-2">
          Download your transactions as a single CSV for tax filing. Pick a
          financial year (or a custom range) and the accounts to include.
        </p>
      </div>

      <ItrBuddy accounts={accounts} />
    </div>
  );
}
