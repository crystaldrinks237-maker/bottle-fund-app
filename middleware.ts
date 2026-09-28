export { default } from 'next-auth/middleware';

// Any route under /admin requires a logged-in session.
// (Role check happens again inside each admin API route / page for safety.)
export const config = { matcher: ['/admin/:path*'] };
