import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// Default: no user logged in
export const handlers = [
  // Health
  http.get('/api/health', () => {
    return HttpResponse.json({ status: 'ok' });
  }),

  // Auth: me — unauthenticated by default
  http.get('/api/auth/me', () => {
    return HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }),

  // Auth: users list
  http.get('/api/auth/users', () => {
    return HttpResponse.json([
      { id: 1, name: 'Admin', avatar_kind: 'icon', avatar_value: 'shield', role: 'admin' },
      { id: 2, name: 'Maria', avatar_kind: 'icon', avatar_value: 'fox', role: 'user' },
      { id: 3, name: 'Nikos', avatar_kind: 'icon', avatar_value: 'unicorn', role: 'user' },
    ]);
  }),

  // Bootstrap status
  http.get('/api/bootstrap/status', () => {
    return HttpResponse.json({ first_run: false });
  }),

  // i18n translations
  http.get('/api/i18n/translations', () => {
    return HttpResponse.json({
      'login.welcome': { el: 'Καλωσήρθες', en: 'Welcome' },
      'common.logout': { el: 'Έξοδος', en: 'Logout' },
    });
  }),

  // Icons catalog
  http.get('/api/icons/catalog', () => {
    return HttpResponse.json([
      { name: 'tooth', category: 'hygiene', svg_ref: 'icons/svg/tooth.svg', keywords_en: ['tooth', 'teeth', 'brush'], keywords_el: ['δόντι', 'δόντια', 'βούρτσισμα'] },
      { name: 'star', category: 'rewards', svg_ref: 'icons/svg/star.svg', keywords_en: ['star', 'points'], keywords_el: ['άστρο', 'πόντοι'] },
      { name: 'shield', category: 'parent', svg_ref: 'icons/svg/shield.svg', keywords_en: ['shield', 'admin'], keywords_el: ['στούπενο', 'διοίκηση'] },
      { name: 'fox', category: 'avatars', svg_ref: 'icons/svg/fox.svg', keywords_en: ['fox', 'animal'], keywords_el: ['αλεπού', 'ζώο'] },
    ]);
  }),
];

export const server = setupServer(...handlers);
