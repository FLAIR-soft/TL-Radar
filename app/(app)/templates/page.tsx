import { LayoutTemplate } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { EmptyState } from '@/components/EmptyState';
import { TemplateRow } from './TemplateRow';

export default async function TemplatesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase.from('profiles').select('locale').eq('id', user!.id).single();
  const dict = getDictionary(profile?.locale ?? 'de');

  const [{ data: templates }, { data: projects }] = await Promise.all([
    supabase.from('task_templates').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
    supabase.from('projects').select('id, name').is('deleted_at', null),
  ]);

  const list = templates ?? [];
  const projectNames = new Map((projects ?? []).map((p) => [p.id, p.name]));

  return (
    <div className="page-fade">
      <h2 className="section-title">{dict.templates.title}</h2>
      <p className="section-sub">{dict.templates.subtitle}</p>
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
    </div>
  );
}
