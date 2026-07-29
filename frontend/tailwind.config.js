/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./lib/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      /**
       * Palette: "petrol & brass".
       * Deep petrol is the clinic's slate board; paper is the chart stock;
       * brass is the engraved ID tag on a collar — used only for the active
       * marker, the paid-plan chip, and pet codes. Clay is warnings only
       * (the Phase 3 allergy banner will claim it).
       */
      colors: {
        petrol: {
          DEFAULT: "#0f2b2a",
          light: "#1a403d",
          lift: "#24514c"
        },
        paper: "#eef2f0",
        line: {
          DEFAULT: "#dde5e1",
          strong: "#c4d2cc"
        },
        ink: {
          DEFAULT: "#12241f",
          soft: "#5c6f68",
          faint: "#8a9a94"
        },
        jade: {
          DEFAULT: "#1a6b58",
          deep: "#125243"
        },
        brass: {
          DEFAULT: "#c9922e",
          soft: "#f6ecd6"
        },
        clay: {
          DEFAULT: "#b0432a",
          soft: "#fbeae5",
          ink: "#7a2c17"
        }
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"]
      },
      maxWidth: {
        shell: "1140px",
        form: "420px"
      },
      keyframes: {
        "rise-in": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" }
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(10px) scale(0.99)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" }
        }
      },
      animation: {
        "rise-in": "rise-in 380ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "fade-in": "fade-in 200ms ease-out both",
        "slide-up": "slide-up 220ms cubic-bezier(0.22, 1, 0.36, 1) both"
      }
    }
  },
  plugins: []
};
