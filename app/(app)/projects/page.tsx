import { FolderKanban } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { ProjectRow } from './ProjectRow';
import { ProjectForm } from './ProjectForm';
import { createProject } from './actions';
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

  const [{ data: projects }, { data: profiles }] = await Promise.all([
    supabase.from('projects').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, name').order('name'),
  ]);

  const list = projects ?? [];
  const profileList = profiles ?? [];
  const profileNames = new Map(profileList.map((p) => [p.id, p.name]));

  return (
    <div className="page-fade">
      <h2 className="section-title">{dict.projects.title}</h2>
      <p className="section-sub">{dict.projects.subtitle}</p>
      <ProjectForm action={createProject} editing={null} profiles={profileList} />
      {list.length ? (
        <div className="project-list">
          {list.map((p, i) => (
            <ProjectRow
              key={p.id}
              project={p}
              ownerName={p.owner_id ? profileNames.get(p.owner_id) ?? null : null}
              profiles={profileList}
              style={{ animationDelay: `${i * 30}ms` }}
            />
          ))}
        </div>
      ) : (
        <EmptyState icon={FolderKanban} title={dict.projects.empty} />
      )}
    </div>
  );
}
