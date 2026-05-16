import { AuthGuard } from "@/components/auth-guard";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { CurrentFamilyProvider } from "@/components/providers/current-family-provider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <CurrentFamilyProvider>
        <div className="flex min-h-full">
          <Sidebar />
          <div className="flex-1 flex flex-col min-h-full">
            <Header />
            <main className="flex-1 p-6 bg-muted/30">
              {children}
            </main>
          </div>
        </div>
      </CurrentFamilyProvider>
    </AuthGuard>
  );
}
