/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "var(--color-primary, #ec4899)", // Pink-500 as default
          hover: "var(--color-primary-hover, #db2777)", // Pink-600 for hover
          darker: "var(--color-primary-darker, #c026d3)", // Fuchsia-600 for a darker pink
        },
        secondary: "var(--color-secondary, #6b7280)", // Gray-500
        light: "var(--color-light, #f9fafb)", // Gray-50
        dark: "var(--color-dark, #1f2937)", // Gray-800
      },
      spacing: {
        section: "var(--spacing-section, 4rem)",
      },
      borderRadius: {
        container: "var(--border-radius-container, 0.75rem)", // 12px
      },
      fontFamily: {
        sans: [
          "Inter Variable",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "Noto Sans",
          "sans-serif",
          "Apple Color Emoji",
          "Segoe UI Emoji",
          "Segoe UI Symbol",
          "Noto Color Emoji",
        ],
      },
    },
  },
  plugins: [],
};
