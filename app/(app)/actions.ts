'use server';

import { redirect } from 'next/navigation';

// Своего выхода у приложения нет: сессию держит шлюз MIDAS, а не мы.
// Кнопка ведёт на выход из MIDAS — после него человек выходит и из Entra.
export async function signOut() {
  redirect('https://midas.mifcom.dev/oauth2/sign_out');
}
