import { LayoutTemplate } from 'lucide-react';
import { rows } from '@/lib/db/client';
import { getLocaleCookie } from '@/lib/i18n/cookie';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { EmptyState } from '@/components/EmptyState';
import { TemplateRow } from './TemplateRow';
import { RecurringRuleRow } from './RecurringRuleRow';
import { CreateRecurringRulePanel } from './CreateRecurringRulePanel';
import type { Project, RecurringRule, TaskTemplate } from '@/lib/db/types';

export default async function TemplatesPage() {
  // Язык больше не хранится в профиле — он живёт в куке, как на дашборде.
  const dict = getDictionary(await getLocaleCookie());

  const [templates, projects, rules] = await Promise.all([
    rows<TaskTemplate>(
      `select * from task_templates where deleted_at is null order by created_at desc`
    ),
    rows<Pick<Project, 'id' | 'name'>>(
      `select id, name from projects where deleted_at is null`
    ),
    // Правила повторения переносятся как есть: исполнителя (pg_cron) больше
    // нет, запуск появится на этапе 8. Экран только показывает и правит их.
    rows<RecurringRule>(
      `select * from recurring_rules where deleted_at is null order by created_at desc`
    ),
  ]);

  const list = templates;
  const projectNames = new Map(projects.map((p) => [p.id, p.name]));
  const templateTitles = new Map(list.map((t) => [t.id, t.title]));
  const ruleList = rules;
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
