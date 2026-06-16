import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import LogoutButton from '@/components/LogoutButton';
import ThemeToggle from '@/components/ThemeToggle';

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  
  if (!session || session.role !== 'EMPLOYEE') {
    redirect('/');
  }

  return (
    <div>
      <nav className="glass-nav">
        <h1 style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--secondary)' }}>Employee Portal</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{session.username}</span>
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
