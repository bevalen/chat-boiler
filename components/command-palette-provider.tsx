"use client"

import { CommandPaletteProvider as Provider } from "@/hooks/use-command-palette"
import { CommandPalette } from "@/components/command-palette"

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  return (
    <Provider>
      {children}
      <CommandPalette />
    </Provider>
  )
}
