import { fetchAwardedPoems } from "@/lib/api"
import AwardsPageClient from "@/components/AwardsPageClient"

export const dynamic = "force-dynamic"

export default async function AwardsPage() {
    const awarded = await fetchAwardedPoems()
    return <AwardsPageClient awarded={awarded.items} />
}
