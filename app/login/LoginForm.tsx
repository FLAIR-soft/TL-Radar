'use client';

import { useActionState, useState } from 'react';
import type { Dictionary } from '@/lib/i18n/get-dictionary';
import { signIn, signUp, type AuthFormState } from './actions';

const initialState: AuthFormState = { error: null };

export function LoginForm({ dict }: { dict: Dictionary }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [role, setRole] = useState<'viewer' | 'editor'>('viewer');
  const [signInState, signInAction, signInPending] = useActionState(signIn, initialState);
  const [signUpState, signUpAction, signUpPending] = useActionState(signUp, initialState);

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand-mark">
          <span className="brand-dot"></span>
          <span>MIFCOM</span>
        </div>
        <h1>TL-Radar</h1>
        <p className="sub">{dict.auth.subtitle}</p>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${mode === 'signin' ? 'active' : ''}`}
            onClick={() => setMode('signin')}
          >
            {dict.auth.tabSignIn}
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => setMode('signup')}
          >
            {dict.auth.tabSignUp}
          </button>
        </div>

        {mode === 'signin' ? (
          <form action={signInAction}>
            {signInState.error && <div className="error-note">{signInState.error}</div>}
            <div className="row2">
              <div className="field">
                <label>{dict.auth.nameLabel}</label>
                <input type="text" name="firstName" required placeholder={dict.auth.namePlaceholder} />
              </div>
              <div className="field">
                <label>{dict.auth.lastNameLabel}</label>
                <input type="text" name="lastName" required placeholder={dict.auth.lastNamePlaceholder} />
              </div>
            </div>
            <div className="field">
              <label>{dict.auth.passwordLabel}</label>
              <input type="password" name="password" required />
            </div>
            <button className="btn btn-primary" disabled={signInPending} type="submit">
              {signInPending && <span className="btn-spinner" />}
              {signInPending ? dict.auth.signInPending : dict.auth.signInButton}
            </button>
          </form>
        ) : (
          <form action={signUpAction}>
            {signUpState.error && <div className="error-note">{signUpState.error}</div>}
            <div className="row2">
              <div className="field">
                <label>{dict.auth.nameLabel}</label>
                <input type="text" name="firstName" required placeholder={dict.auth.namePlaceholder} />
              </div>
              <div className="field">
                <label>{dict.auth.lastNameLabel}</label>
                <input type="text" name="lastName" required placeholder={dict.auth.lastNamePlaceholder} />
              </div>
            </div>
            <div className="field">
              <label>{dict.auth.passwordLabel}</label>
              <input type="password" name="password" required minLength={6} />
            </div>
            <div className="field">
              <label>{dict.auth.roleLabel}</label>
              <div className="radio-row">
                <label className={`radio-opt ${role === 'viewer' ? 'sel' : ''}`}>
                  <input
                    type="radio"
                    name="role"
                    value="viewer"
                    checked={role === 'viewer'}
                    onChange={() => setRole('viewer')}
                  />
                  {dict.auth.roleViewer}
                </label>
                <label className={`radio-opt ${role === 'editor' ? 'sel' : ''}`}>
                  <input
                    type="radio"
                    name="role"
                    value="editor"
                    checked={role === 'editor'}
                    onChange={() => setRole('editor')}
                  />
                  {dict.auth.roleEditor}
                </label>
              </div>
            </div>
            <button className="btn btn-primary" disabled={signUpPending} type="submit">
              {signUpPending && <span className="btn-spinner" />}
              {signUpPending ? dict.auth.signUpPending : dict.auth.signUpButton}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
