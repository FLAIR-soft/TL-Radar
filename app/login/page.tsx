'use client';

import { useActionState, useState } from 'react';
import { signIn, signUp, type AuthFormState } from './actions';

const initialState: AuthFormState = { error: null };

export default function LoginPage() {
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
        <p className="sub">
          Кто чем занят и где — без лишних вопросов. Войдите или зарегистрируйтесь.
        </p>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${mode === 'signin' ? 'active' : ''}`}
            onClick={() => setMode('signin')}
          >
            Вход
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => setMode('signup')}
          >
            Регистрация
          </button>
        </div>

        {mode === 'signin' ? (
          <form action={signInAction}>
            {signInState.error && <div className="error-note">{signInState.error}</div>}
            <div className="field">
              <label>Email</label>
              <input type="email" name="email" required placeholder="you@example.com" />
            </div>
            <div className="field">
              <label>Пароль</label>
              <input type="password" name="password" required />
            </div>
            <button className="btn btn-primary" disabled={signInPending} type="submit">
              {signInPending ? 'Вход…' : 'Войти'}
            </button>
          </form>
        ) : (
          <form action={signUpAction}>
            {signUpState.error && <div className="error-note">{signUpState.error}</div>}
            <div className="field">
              <label>Имя</label>
              <input type="text" name="name" required placeholder="Например, Anna K." />
            </div>
            <div className="field">
              <label>Email</label>
              <input type="email" name="email" required placeholder="you@example.com" />
            </div>
            <div className="field">
              <label>Пароль</label>
              <input type="password" name="password" required minLength={6} />
            </div>
            <div className="field">
              <label>Роль</label>
              <div className="radio-row">
                <label className={`radio-opt ${role === 'viewer' ? 'sel' : ''}`}>
                  <input
                    type="radio"
                    name="role"
                    value="viewer"
                    checked={role === 'viewer'}
                    onChange={() => setRole('viewer')}
                  />
                  Зритель
                </label>
                <label className={`radio-opt ${role === 'editor' ? 'sel' : ''}`}>
                  <input
                    type="radio"
                    name="role"
                    value="editor"
                    checked={role === 'editor'}
                    onChange={() => setRole('editor')}
                  />
                  Редактор
                </label>
              </div>
            </div>
            <button className="btn btn-primary" disabled={signUpPending} type="submit">
              {signUpPending ? 'Регистрация…' : 'Зарегистрироваться'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
