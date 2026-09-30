import { withAuth } from 'next-auth/middleware';

// First line of defence only (is there a session?). Real authorisation — roles, ownership, active flag —
// is enforced again on the server in every API route and layout via lib/session.ts.
export default withAuth({ pages: { signIn: '/login' } });
export const config = {
  // /api/* is excluded on purpose: every API route authenticates itself and answers 401/403 as JSON (not a redirect).
  matcher: ['/((?!api|login|signup|_next|logo|icon|favicon).*)'],
};
