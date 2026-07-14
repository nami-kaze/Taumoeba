import DashboardPage from "./page";
import { BarLoader } from "react-spinners";
import { Suspense } from "react";
import { PrivacyProvider } from "./_components/privacy-context";
import { PrivacyToggle } from "./_components/privacy-toggle";

export default function Layout() {
  return (
    <PrivacyProvider>
      <div className="px-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <h1 className="text-6xl font-bold tracking-tight gradient-title">
              Dashboard
            </h1>
            <PrivacyToggle />
          </div>
        </div>
        <Suspense
          fallback={<BarLoader className="mt-4" width={"100%"} color="#9333ea" />}
        >
          <DashboardPage />
        </Suspense>
      </div>
    </PrivacyProvider>
  );
}
