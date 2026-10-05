import { useState } from "react"
import { Dices } from "lucide-react"

import Navbar from "@/components/home/Navbar"

import SpinWheelCanvas, {
  type SpinWheelItem,
} from "@/components/spinwheel/Wheel"
import SpinWheelSidebar from "@/components/spinwheel/Sidebar"

export default function SpinWheel() {
  const [items, setItems] = useState<SpinWheelItem[]>([])

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <Navbar />

      <main className="min-h-[calc(100vh-5rem)] pt-20">
        <div className="mx-auto flex w-full max-w-[1900px] flex-col px-4 py-5 sm:px-6 lg:px-8 lg:py-6 xl:px-10">
          <div className="mb-5">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold text-blue-500">
              <Dices className="h-4 w-4" />
              TOOLS
            </div>

            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              Spin Wheel
            </h1>

            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Create a custom wheel and randomly select an entry.
            </p>
          </div>

          <section className="grid min-h-[calc(100vh-10.5rem)] gap-4 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_410px]">
            <SpinWheelCanvas items={items} />

            <SpinWheelSidebar
              items={items}
              onChange={setItems}
            />
          </section>
        </div>
      </main>
    </div>
  )
}
