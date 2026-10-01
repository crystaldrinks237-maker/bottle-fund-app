import { withAuth } from 'next-auth/middleware';

// First line of defence only (is there a session?). Real authorisation — roles, ownership, active flag —
// is enforced again on the server in every API route and layout via lib/session.ts.
export default withAuth({ pages: { signIn: '/login' } });
export const config = {
  // Only the signed-in areas are gated here. "/" (welcome page), /login, /signup and /api/* are public at this layer;
  // every API route authenticates itself, and every signed-in layout re-checks the session and role.
  matcher: ['/admin/:path*', '/dashboard/:path*', '/investments/:path*', '/funding-needs/:path*', '/payouts/:path*', '/profile/:path*', '/guarantor/:path*', '/notifications/:path*'],
};
