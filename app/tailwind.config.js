/** Tailwind is used ONLY for the public homepage (app/page.tsx + components/site). The funding app (/funds) keeps its own CSS. */
module.exports = {
  content: ['./app/page.tsx', './app/review/**/*.tsx', './components/site/**/*.{ts,tsx}'],
  important: '.mp', // every utility is scoped under the homepage wrapper, so nothing can leak into /funds
  corePlugins: { preflight: false }, // a scoped reset lives in components/site/site.css instead
  theme: {
    extend: {
      colors: { midnight: '#06172B', ocean: '#0B2945', ice: '#C9E8F5', mist: '#EEF6FA', silver: '#BFCBD5', champagne: '#D8CDBA', danger: '#FCA5A5' },
      fontFamily: { serif: ['"Cormorant Garamond"', 'Georgia', 'serif'], sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'] },
      letterSpacing: { label: '0.28em' },
    },
  },
};
