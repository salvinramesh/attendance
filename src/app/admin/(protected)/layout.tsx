import { requireAdmin } from '@/lib/auth';
import { redirect } from 'next/navigation';
import LogoutButton from '@/components/LogoutButton';
import ThemeToggle from '@/components/ThemeToggle';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  
  if (!admin) {
    redirect('/admin/login');
  }

  return (
    <div>
      <nav className="glass-nav">
        <h1 style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--primary)' }}>Admin Console</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{admin.username}</span>
          <ThemeToggle />
          <LogoutButton />
        </div>
      </nav>
      <main className="page-container">
        {children}
      </main>
    </div>
  );
}
