import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { ResetPasswordForm } from './ResetPasswordForm';
import { DeleteUserButton } from './DeleteUserButton';

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, locale')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') redirect('/dashboard');

  const dict = getDictionary(profile?.locale ?? 'de');

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, role')
    .order('name', { ascending: true });

  return (
    <div className="page-fade">
      <h2 className="section-title">{dict.admin.title}</h2>
      <p className="section-sub">{dict.admin.subtitle}</p>
      <div className="admin-list">
        {(profiles ?? []).map((p) => (
          <div key={p.id} className="admin-row">
            <div className="admin-row-info">
              <span className="admin-row-name">{p.name}</span>
              <span
                className="pill"
                style={{ ['--pill-color' as string]: p.role === 'admin' ? 'var(--brand-dark)' : 'var(--tint-indigo-ink)' }}
              >
                {p.role === 'admin' ? dict.admin.roleAdmin : dict.admin.roleEditor}
              </span>
            </div>
            <div className="admin-row-actions">
              <ResetPasswordForm userId={p.id} />
              {p.id !== user.id && <DeleteUserButton userId={p.id} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
