import { LayoutTemplate } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCachedUser, getCachedProfile } from '@/lib/supabase/request-cache';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { EmptyState } from '@/components/EmptyState';
import { TemplateRow } from './TemplateRow';
import { RecurringRuleRow } from './RecurringRuleRow';
import { CreateRecurringRulePanel } from './CreateRecurringRulePanel';

export default async function TemplatesPage() {
  const supabase = await createClient();
  const user = await getCachedUser();
  const profile = await getCachedProfile(user!.id);
  const dict = getDictionary(profile?.locale ?? 'de');

  const [{ data: templates }, { data: projects }, { data: rules }] = await Promise.all([
    supabase.from('task_templates').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
    supabase.from('projects').select('id, name').is('deleted_at', null),
    supabase.from('recurring_rules').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
  ]);

  const list = templates ?? [];
  const projectNames = new Map((projects ?? []).map((p) => [p.id, p.name]));
  const templateTitles = new Map(list.map((t) => [t.id, t.title]));
  const ruleList = rules ?? [];
  const templateOptions = list.map((t) => ({ id: t.id, title: t.title }));

  return (
    <div className="page-fade templates-layout">
      <section>
        <div className="page-header">
          <div>
            <h2 className="section-title">{dict.templates.title}</h2>
            <p className="section-sub">{dict.templates.subtitle}</p>
          </div>
        </div>
      {list.length ? (
        <div className="project-list">
          {list.map((t, i) => (
            <TemplateRow
              key={t.id}
              template={t}
              projectName={t.project_id ? projectNames.get(t.project_id) ?? null : null}
              style={{ animationDelay: `${i * 30}ms` }}
            />
          ))}
        </div>
      ) : (
        <EmptyState icon={LayoutTemplate} title={dict.templates.empty} />
      )}
      </section>
      <section>
        <div className="page-header">
          <div>
            <h2 className="section-title">{dict.recurring.title}</h2>
            <p className="section-sub">{dict.recurring.subtitle}</p>
          </div>
          {list.length > 0 && <CreateRecurringRulePanel templates={templateOptions} />}
        </div>
      {list.length === 0 ? (
        <p className="section-sub">{dict.recurring.noTemplatesHint}</p>
      ) : ruleList.length ? (
        <div className="project-list">
          {ruleList.map((r, i) => (
            <RecurringRuleRow
              key={r.id}
              rule={r}
              templateTitle={templateTitles.get(r.template_id) ?? dict.recurring.templatePlaceholder}
              style={{ animationDelay: `${i * 30}ms` }}
            />
          ))}
        </div>
      ) : (
        <EmptyState icon={LayoutTemplate} title={dict.recurring.empty} />
      )}
      </section>
    </div>
  );
}
