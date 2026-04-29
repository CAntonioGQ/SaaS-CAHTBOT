import { Sidebar } from '@/components/layout/Sidebar';

// Dashboard shell — persistent sidebar + main content area.
// In Angular this would be the AppComponent with a router-outlet.
// In Next.js App Router, nested layout.tsx files wrap child pages.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
