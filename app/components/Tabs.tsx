export default function Tabs({
    tabs,
    tab,
    onTab,
    className,
}: {
    tabs: string[]
    tab: number
    onTab: (tab: number) => void
    className?: string
}) {
    return (
        <div className={`flex items-baseline gap-5 ${className}`}>
            {tabs.map((t, i) => (
                <button
                    key={tabs[i]}
                    type="button"
                    onClick={() => onTab(i)}
                    className={`button-tab text-xs ${
                        tab === i ? "button-tab-active" : "button-tab-inactive"
                    }`}
                >
                    {t}
                </button>
            ))}
        </div>
    )
}
