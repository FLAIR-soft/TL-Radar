'use client';

import { useState, useTransition } from 'react';
import { useDictionary } from '@/lib/i18n/LocaleContext';
import { resetUserPassword } from './actions';

export function ResetPasswordForm({ userId }: { userId: string }) {
  const dict = useDictionary();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm(dict.admin.resetConfirm)) return;
    setError(null);
    setSuccess(false);
    startTransition(() => {
      resetUserPassword(userId, password).then((result) => {
        if (result?.error) {
          setError(result.error);
        } else {
          setSuccess(true);
          setPassword('');
        }
      });
    });
  }

  return (
    <form className="admin-reset-form" onSubmit={handleSubmit}>
      <input
        type="password"
        placeholder={dict.admin.newPasswordPlaceholder}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={6}
      />
      <button className={`btn ${password ? 'btn-dark' : 'btn-ghost'}`} type="submit" disabled={isPending}>
        {isPending && <span className="btn-spinner" />}
        {dict.admin.resetButton}
      </button>
      {error && <div className="admin-reset-error">{error}</div>}
      {success && <div className="admin-reset-success">{dict.admin.resetSuccess}</div>}
    </form>
  );
}
