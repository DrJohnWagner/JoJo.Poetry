"use client"

import { createContext, useContext } from "react"

interface AppConfig {
    readOnly: boolean
}

const AppConfigContext = createContext<AppConfig>({ readOnly: true })

export function AppConfigProvider({
    readOnly,
    children,
}: {
    readOnly: boolean
    children: React.ReactNode
}) {
    return (
        <AppConfigContext.Provider value={{ readOnly }}>
            {children}
        </AppConfigContext.Provider>
    )
}

export function useAppConfig(): AppConfig {
    return useContext(AppConfigContext)
}
