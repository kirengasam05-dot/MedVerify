export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'], mono: ['"IBM Plex Mono"', 'monospace'] },
      colors: {
        paper: '#F5F6F2', ink: '#14222B', teal: '#0F5C6E',
        genuine: '#1F8A5B', amber: '#B97A0B', alert: '#C2322B'
      }
    }
  }
}
