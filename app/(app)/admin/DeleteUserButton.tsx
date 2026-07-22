'use client';

import { useState, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { useDictionary } from '@/lib/i18n/LocaleContext';
import { deleteUser } from './actions';

export function DeleteUserButton({ userId }: { userId: string }) {
  const dict = useDictionary();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(dict.admin.deleteConfirm)) return;
    setError(null);
    startTransition(() => {
      deleteUser(userId).then((result) => {
        if (result?.error) setError(result.error);
      });
    });
  }

  return (
    <div className="admin-row-delete">
      <button
        className="icon-btn"
        type="button"
        title={dict.admin.deleteTitle}
        disabled={isPending}
        onClick={handleDelete}
        data-testid="delete-user"
      >
        <Trash2 size={16} strokeWidth={1.75} />
      </button>
      {error && <div className="admin-reset-error">{error}</div>}
    </div>
  );
}
