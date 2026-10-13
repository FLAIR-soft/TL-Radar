import { TriangleAlert } from 'lucide-react';
import { plural } from '@/lib/i18n/plural';
import { rows } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/auth/current-user';
import { getLocaleCookie } from '@/lib/i18n/cookie';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { getInitials, getAvatarColor } from '@/lib/logic/initials';
import { WipLimitsForm } from './WipLimitsForm';
import type { Person, WipLimit } from '@/lib/db/types';

export default async function AdminPage() {
  // Сброса паролей и удаления учётных записей здесь больше нет: ими
  // распоряжается Entra, а не приложение. Остались WIP-лимиты и список людей.
  const user = await getCurrentUser();
  const dict = getDictionary(await getLocaleCookie());

  const [people, wipLimits, activeTasks] = await Promise.all([
    rows<Person>(`select * from people order by coalesce(display_name, email)`),
    rows<WipLimit>(`select * from wip_limits`),
    // Только статусы активных задач — чтобы показать, какая колонка уже
    // упёрлась в свой лимит. Одним запросом, без задач целиком.
    rows<{ status: string }>(
      `select status from tasks where status <> 'done' and deleted_at is null`
    ),
  ]);

  const countByStatus = new Map<string, number>();
  for (const t of activeTasks) countByStatus.set(t.status, (countByStatus.get(t.status) ?? 0) + 1);

  const fullColumns = wipLimits.filter(
    (w) => w.limit_count !== null && (countByStatus.get(w.status) ?? 0) >= w.limit_count
  );

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
      <WipLimitsForm limits={wipLimits} />
      {fullColumns.map((w) => (
        <div className="wip-full-warning" key={w.status}>
          <TriangleAlert size={14} strokeWidth={2} />
          {dict.wipLimits.fullWarning
            .replace('{status}', dict.status[w.status as 'waiting' | 'in_progress' | 'paused'])
            .replace('{n}', String(countByStatus.get(w.status) ?? 0))
            .replace('{limit}', String(w.limit_count))}
        </div>
      ))}
      <div className="admin-users-head">
        <h3 className="section-title analytics-subsection-title">{dict.admin.usersTitle}</h3>
        <span className="mono admin-accounts-count">
          {plural(dict.admin.accountsCount, people.length, dict.intlLocale)}
        </span>
      </div>
      <div className="admin-list">
        {people.map((p) => {
          const isSelf = p.email === user.email;
          const name = p.display_name ?? p.email;
          return (
            <div key={p.email} className="admin-row">
              <span
                className={`admin-avatar ${isSelf ? 'admin-avatar-self' : ''}`}
                style={isSelf ? undefined : { ['--avatar-color' as string]: getAvatarColor(p.email) }}
              >
                {getInitials(name)}
              </span>
              <div className="admin-row-info">
                <span className="admin-row-name">{name}</span>
                <span className="admin-row-username mono">{p.email}</span>
                {/* Человек, заведённый по почте и ещё не заходивший: имени нет. */}
                {!p.display_name && (
                  <span className="pill" style={{ ['--pill-color' as string]: 'var(--ink-muted)' }}>
                    {dict.admin.roleEditor}
                  </span>
                )}
                {isSelf && (
                  <span className="pill" style={{ ['--pill-color' as string]: 'var(--ink-muted)' }}>
                    {dict.admin.selfLabel}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
