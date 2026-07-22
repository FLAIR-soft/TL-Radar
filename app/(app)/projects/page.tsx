import { FolderKanban } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { NewProjectForm } from './NewProjectForm';
import { ProjectRow } from './ProjectRow';
import { EmptyState } from '@/components/EmptyState';

export default async function ProjectsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('locale')
    .eq('id', user!.id)
    .single();

  const dict = getDictionary(profile?.locale ?? 'de');

  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  const list = projects ?? [];

  return (
    <div className="page-fade">
      <h2 className="section-title">{dict.projects.title}</h2>
      <p className="section-sub">{dict.projects.subtitle}</p>
      <NewProjectForm />
      {list.length ? (
        <div className="project-list">
          {list.map((p, i) => (
            <ProjectRow key={p.id} project={p} style={{ animationDelay: `${i * 30}ms` }} />
          ))}
        </div>
      ) : (
        <EmptyState icon={FolderKanban} title={dict.projects.empty} />
      )}
    </div>
  );
}
