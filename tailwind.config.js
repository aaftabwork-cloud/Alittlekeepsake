/** @type {import('tailwindcss').Config}
 *
 * Theme note: the app was originally skinned dark ("ink/paper/gold").
 * The class names stayed, the values are now the light white+blue theme —
 * ink-* = surfaces (light), paper-* = text (navy), gold-* = blue accent.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#f3f6fa', // app background
          900: '#ffffff', // chrome bars
          850: '#fbfcfe', // panels
          800: '#f1f4f9', // inputs / wells
          700: '#dae2ec', // borders
          600: '#b9c6d8', // strong borders / inactive
        },
        paper: {
          DEFAULT: '#1b2a41', // primary text (navy)
          dim: '#475972',
          faint: '#7d8ca3',
        },
        gold: {
          DEFAULT: '#2563eb', // accent (blue)
          bright: '#3b82f6',
          deep: '#1e4fd6',
        },
        danger: '#dc2626',
      },
      fontFamily: {
        display: ['Fraunces', 'serif'],
        ui: ['"Instrument Sans"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['10.5px', '14px'],
      },
      boxShadow: {
        panel: '0 1px 2px rgba(23, 43, 77, 0.06)',
        pop: '0 10px 34px rgba(23, 43, 77, 0.16), 0 0 0 1px rgba(23, 43, 77, 0.05)',
        board: '0 14px 44px rgba(23, 43, 77, 0.16)',
      },
    },
  },
  plugins: [],
}
