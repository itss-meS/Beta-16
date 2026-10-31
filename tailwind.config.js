export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--c-bg) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        sunken: 'rgb(var(--c-sunken) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        primary: 'rgb(var(--c-primary) / <alpha-value>)',
        'on-primary': 'rgb(var(--c-on-primary) / <alpha-value>)',
        'primary-soft': 'rgb(var(--c-primary-soft) / <alpha-value>)',
        good: 'rgb(var(--c-good) / <alpha-value>)',
        'good-soft': 'rgb(var(--c-good-soft) / <alpha-value>)',
        warn: 'rgb(var(--c-warn) / <alpha-value>)',
        'warn-soft': 'rgb(var(--c-warn-soft) / <alpha-value>)',
        bad: 'rgb(var(--c-bad) / <alpha-value>)',
        'bad-soft': 'rgb(var(--c-bad-soft) / <alpha-value>)'
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Roboto', '"Segoe UI"', 'Arial', 'sans-serif']
      }
    }
  },
  plugins: []
};
