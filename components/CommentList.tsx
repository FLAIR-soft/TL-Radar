'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { useDictionary } from '@/lib/i18n/LocaleContext';
import { useToast } from './ToastProvider';
import { fmtDateTime } from '@/lib/logic/tasks';
import { splitMentionSegments, type MentionableProfile } from '@/lib/logic/mentions';
import { addComment, deleteComment } from '@/app/(app)/dashboard/comments-actions';
import type { TaskComment } from '@/lib/supabase/types';

const MENTION_SUGGESTION_LIMIT = 6;

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
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [body, setBody] = useState('');
  const [mentionProfiles, setMentionProfiles] = useState<MentionableProfile[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch('/api/mentionable-profiles')
      .then((r) => r.json())
      .then((data) => setMentionProfiles(data.profiles ?? []))
      .catch(() => {});
  }, []);

  const usernameToName = useMemo(
    () => new Map(mentionProfiles.map((p) => [p.username, p.name])),
    [mentionProfiles]
  );

  const mentionMatches = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return mentionProfiles
      .filter((p) => p.username.toLowerCase().startsWith(q) || p.name.toLowerCase().includes(q))
      .slice(0, MENTION_SUGGESTION_LIMIT);
  }, [mentionProfiles, mentionQuery]);

  function resolveName(id: string | null): string {
    if (!id) return dict.activityLog.unknownUser;
    return profileNames.get(id) ?? dict.activityLog.unknownUser;
  }

  function handleBodyChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setBody(value);
    const cursor = e.target.selectionStart ?? value.length;
    const before = value.slice(0, cursor);
    const atIndex = before.lastIndexOf('@');
    const fragment = atIndex === -1 ? null : before.slice(atIndex + 1);
    if (fragment === null || /\s/.test(fragment)) {
      setMentionQuery(null);
      return;
    }
    setMentionQuery(fragment);
    setMentionIndex(0);
  }

  function selectMention(profile: MentionableProfile) {
    const textarea = textareaRef.current;
    const cursor = textarea?.selectionStart ?? body.length;
    const before = body.slice(0, cursor);
    const atIndex = before.lastIndexOf('@');
    if (atIndex === -1) return;
    const after = body.slice(cursor);
    const inserted = `@${profile.username} `;
    setBody(body.slice(0, atIndex) + inserted + after);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      const pos = atIndex + inserted.length;
      textarea?.focus();
      textarea?.setSelectionRange(pos, pos);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionQuery === null || mentionMatches.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMentionIndex((i) => (i + 1) % mentionMatches.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMentionIndex((i) => (i - 1 + mentionMatches.length) % mentionMatches.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      selectMention(mentionMatches[mentionIndex]);
    } else if (e.key === 'Escape') {
      setMentionQuery(null);
    }
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
          toast.error(result.error);
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
        if (result?.error) toast.error(result.error);
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
            <div className="comment-body">
              {splitMentionSegments(c.body).map((seg, i) => {
                const name = seg.mentionUsername ? usernameToName.get(seg.mentionUsername) : null;
                return name ? (
                  <span className="mention" key={i}>
                    @{name}
                  </span>
                ) : (
                  <span key={i}>{seg.text}</span>
                );
              })}
            </div>
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
        <div className="comment-input-wrap">
          <textarea
            ref={textareaRef}
            className="comment-input"
            placeholder={dict.comments.placeholder}
            value={body}
            onChange={handleBodyChange}
            onKeyDown={handleKeyDown}
            disabled={isPending}
            rows={2}
            data-testid="comment-input"
          />
          {mentionMatches.length > 0 && (
            <div className="mention-suggestions" data-testid="mention-suggestions">
              {mentionMatches.map((p, i) => (
                <button
                  type="button"
                  key={p.id}
                  className={`mention-suggestion ${i === mentionIndex ? 'mention-suggestion-active' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectMention(p);
                  }}
                  data-testid="mention-suggestion"
                >
                  <span>{p.name}</span>
                  <span className="mono">@{p.username}</span>
                </button>
              ))}
            </div>
          )}
        </div>
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
