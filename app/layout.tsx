import type { Metadata } from "next"
import { Crimson_Pro, Fraunces, Inter } from "next/font/google"
import Link from "next/link"
import { fetchAuthor } from "@/lib/api"
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

export async function generateMetadata(): Promise<Metadata> {
    const author = await fetchAuthor().catch(() => ({
        pen_name: "JoJo",
        full_name: "John Wagner",
    }))
    return {
        title: `${author.pen_name} — Poems`,
        description: `Collected poems by ${author.pen_name}.`,
    }
}

export default async function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const readOnly = process.env.READ_ONLY !== "false"
    const author = await fetchAuthor().catch(() => ({
        pen_name: "JoJo",
        full_name: "John Wagner",
    }))
    return (
        <html
            lang="en"
            className={`${serif.variable} ${display.variable} ${sans.variable}`}
        >
            <body suppressHydrationWarning>
                <AppConfigProvider readOnly={readOnly}>
                    <div className="px-6 pb-24 pt-16">
                        <main>{children}</main>
                        <footer className="text-label mx-auto mt-12 max-w-prose border-t border-rule pt-8">
                            © {author.pen_name} ({author.full_name}) ·{" "}
                            <Link href="/">Index</Link>
                        </footer>
                    </div>
                </AppConfigProvider>
            </body>
        </html>
    )
}
