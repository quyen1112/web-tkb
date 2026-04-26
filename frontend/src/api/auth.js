/**
 * Auth API — login, me, logout
 * Redirect theo vai_tro sau login (design.md mục 8)
 */
import client from './client';

export const auth = {
  login: (email, mat_khau) =>
    client.post('/auth/login', { email, mat_khau }).then(r => r.data),

  me: () =>
    client.get('/auth/me').then(r => r.data),
};