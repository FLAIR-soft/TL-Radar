'use client';

import { useState, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { useDictionary } from '@/lib/i18n/LocaleContext';
import { fmtDateTime } from '@/lib/logic/tasks';
import { addComment, deleteComment } from '@/app/(app)/dashboard/comments-actions';
import type { TaskComment } from '@/lib/supabase/types';

export function CommentList({
  taskId,
  comments,
  currentUserId,
  isAdmin,
  profileNames,
  onChange,
}: {
  taskId: string;
  comments: TaskComment[];
  currentUserId: string | null;
  isAdmin: boolean;
  profileNames: Map<string, string>;
  onChange: () => void;
}) {
  const dict = useDictionary();
  const [isPending, startTransition] = useTransition();
  const [body, setBody] = useState('');

  function resolveName(id: string | null): string {
    if (!id) return dict.activityLog.unknownUser;
    return profileNames.get(id) ?? dict.activityLog.unknownUser;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    const formData = new FormData();
    formData.set('body', text);
    startTransition(() => {
      addComment(taskId, formData).then((result) => {
        if (result?.error) {
          alert(result.error);
          return;
        }
        setBody('');
        onChange();
      });
    });
  }

  function handleDelete(commentId: string) {
    if (!confirm(dict.comments.deleteConfirm)) return;
    startTransition(() => {
      deleteComment(commentId).then((result) => {
        if (result?.error) alert(result.error);
        onChange();
      });
    });
  }

  return (
    <div className="comment-list">
      {comments.length === 0 ? (
        <div className="empty-note">{dict.comments.empty}</div>
      ) : (
        comments.map((c) => (
          <div className="comment-row" key={c.id}>
            <div className="comment-body">{c.body}</div>
            <div className="comment-meta mono">
              <span>
                {resolveName(c.author_id)} · {fmtDateTime(c.created_at, dict.intlLocale)}
              </span>
              {(c.author_id === currentUserId || isAdmin) && (
                <button
                  type="button"
                  className="icon-btn comment-delete"
                  title={dict.comments.deleteTitle}
                  disabled={isPending}
                  onClick={() => handleDelete(c.id)}
                  data-testid="delete-comment"
                >
                  <Trash2 size={14} strokeWidth={1.75} />
                </button>
              )}
            </div>
          </div>
        ))
      )}
      <form className="comment-form" onSubmit={handleSubmit}>
        <textarea
          className="comment-input"
          placeholder={dict.comments.placeholder}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={isPending}
          rows={2}
          data-testid="comment-input"
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isPending || !body.trim()}
          data-testid="comment-submit"
        >
          {isPending && <span className="loading-spinner" />}
          {dict.comments.submit}
        </button>
      </form>
    </div>
  );
}
