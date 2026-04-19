import type { Metadata } from "next"
import { Crimson_Pro, Fraunces, Inter } from "next/font/google"
import Link from "next/link"
import { AppConfigProvider } from "@/components/AppConfig"
import "./globals.css"

const serif = Crimson_Pro({
    subsets: ["latin"],
    variable: "--font-serif",
    display: "swap",
})
const display = Fraunces({
    subsets: ["latin"],
    variable: "--font-display",
    display: "swap",
})
const sans = Inter({
    subsets: ["latin"],
    variable: "--font-sans",
    display: "swap",
})

export const metadata: Metadata = {
    title: "JoJo — Poems",
    description: "Collected poems by JoJo.",
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const readOnly = process.env.READ_ONLY !== "false"
    return (
        <html
            lang="en"
            className={`${serif.variable} ${display.variable} ${sans.variable}`}
        >
            <body suppressHydrationWarning>
                <AppConfigProvider readOnly={readOnly}>
                    <div className="px-6 pb-24 pt-16">
                        <main>{children}</main>
                        <footer className="mx-auto max-w-prose eyebrow mt-12 border-t border-rule pt-8">
                            © JoJo · <Link href="/">Index</Link>
                        </footer>
                    </div>
                </AppConfigProvider>
            </body>
        </html>
    )
}
