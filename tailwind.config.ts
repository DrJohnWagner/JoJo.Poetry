import type { Config } from "tailwindcss";

const config: Config = {
    content: ["./app/**/*.{ts,tsx}"],
    theme: {
        extend: {
            colors: {
                // Deliberately small palette: paper, ink, a muted accent.
                paper: "#faf8f4",
                ink: "#1b1a17",
                muted: "#4b4740", //"#6b655c",
                rule: "#d9d3c7",
                accent: "#7a4e2e", // dark ochre — used only for interactive accents
            },
            fontFamily: {
                // Served via next/font in app/layout.tsx.
                serif: ["var(--font-serif)", "Georgia", "ui-serif", "serif"],
                display: [
                    "var(--font-display)",
                    "Georgia",
                    "ui-serif",
                    "serif",
                ],
                sans: [
                    "var(--font-sans)",
                    "ui-sans-serif",
                    "system-ui",
                    "sans-serif",
                ],
            },
            maxWidth: {
                prose: "38rem", // ~608px — comfortable measure for poetry
            },
            letterSpacing: {
                wider2: "0.14em",
            },
        },
    },
    plugins: [],
}

export default config;
