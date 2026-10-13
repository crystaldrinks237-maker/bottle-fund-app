/** @type {import('next').NextConfig} */
module.exports = {
  experimental: { serverComponentsExternalPackages: ['pg', 'ws', 'bcryptjs'] },
  poweredByHeader: false,
  // The funding platform now lives under /funds. Old bookmarks, emailed links, saved notifications and shared referral links keep working.
  async redirects() {
    const old = ['admin', 'dashboard', 'investments', 'funding-needs', 'payouts', 'profile', 'guarantor', 'notifications', 'login', 'signup', 'r'];
    return old.flatMap(p => [{ source: `/${p}`, destination: `/funds/${p}`, permanent: false }, { source: `/${p}/:path*`, destination: `/funds/${p}/:path*`, permanent: false }])
      .filter(r => !r.source.startsWith('/r') || r.source.startsWith('/r/'));
  },
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'same-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    }];
  },
};
