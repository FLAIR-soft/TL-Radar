import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TopTabs } from './TopTabs';
import { signOut } from './actions';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', user.id)
    .single();

  const name = profile?.name ?? user.email ?? 'Пользователь';
  const role = profile?.role ?? 'viewer';

  return (
    <div className="app-root">
      <div className="topbar">
        <div className="topbar-left">
          <div className="brand-mark">
            <span className="brand-dot"></span>
            <span>TL-Radar</span>
          </div>
          <TopTabs role={role} />
        </div>
        <div className="who">
          <span className={`role-badge role-${role}`}>{role === 'editor' ? 'Редактор' : 'Зритель'}</span>
          <span className="name">{name}</span>
          <form action={signOut}>
            <button className="btn btn-ghost" type="submit">
              Выйти
            </button>
          </form>
        </div>
      </div>
      <main>{children}</main>
    </div>
  );
}
