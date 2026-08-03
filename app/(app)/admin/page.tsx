import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCachedUser, getCachedProfile } from '@/lib/supabase/request-cache';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { getInitials, getAvatarColor } from '@/lib/logic/initials';
import { ResetPasswordForm } from './ResetPasswordForm';
import { DeleteUserButton } from './DeleteUserButton';
import { WipLimitsForm } from './WipLimitsForm';

export default async function AdminPage() {
  const supabase = await createClient();
  const user = await getCachedUser();

  if (!user) redirect('/login');

  const profile = await getCachedProfile(user.id);

  if (profile?.role !== 'admin') redirect('/dashboard');

  const dict = getDictionary(profile?.locale ?? 'de');

  const [{ data: profiles }, { data: wipLimits }] = await Promise.all([
    supabase.from('profiles').select('id, name, username, role').order('name', { ascending: true }),
    supabase.from('wip_limits').select('*'),
  ]);

  return (
    <div className="page-fade">
      <div className="page-header">
        <div>
          <h2 className="section-title">{dict.admin.title}</h2>
          <p className="section-sub">{dict.admin.subtitle}</p>
        </div>
      </div>
      <h3 className="section-title analytics-subsection-title">{dict.wipLimits.title}</h3>
      <p className="section-sub">{dict.wipLimits.subtitle}</p>
      <WipLimitsForm limits={wipLimits ?? []} />
      <h3 className="section-title analytics-subsection-title">{dict.admin.usersTitle}</h3>
      <div className="admin-list">
        {(profiles ?? []).map((p) => {
          const isSelf = p.id === user.id;
          return (
          <div key={p.id} className="admin-row">
            <span
              className={`admin-avatar ${isSelf ? 'admin-avatar-self' : ''}`}
              style={isSelf ? undefined : { background: getAvatarColor(p.id) }}
            >
              {getInitials(p.name)}
            </span>
            <div className="admin-row-info">
              <span className="admin-row-name">{p.name}</span>
              <span className="admin-row-username mono">@{p.username}</span>
              <span
                className="pill"
                style={{ ['--pill-color' as string]: p.role === 'admin' ? 'var(--brand-dark)' : 'var(--tint-indigo-ink)' }}
              >
                {p.role === 'admin' ? dict.admin.roleAdmin : dict.admin.roleEditor}
              </span>
              {isSelf && (
                <span className="pill" style={{ ['--pill-color' as string]: 'var(--ink-muted)' }}>
                  {dict.admin.selfLabel}
                </span>
              )}
            </div>
            <div className="admin-row-actions">
              <ResetPasswordForm userId={p.id} />
              {p.id !== user.id && <DeleteUserButton userId={p.id} />}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
