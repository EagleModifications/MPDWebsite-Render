import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Wheel, type WheelHandle } from "@/components/spinwheel/Wheel";
import { WheelSidebar } from "@/components/spinwheel/WheelSidebar";
import { WinnerDialog } from "@/components/spinwheel/WinnerDialog";
import type { WheelEntry } from "@/components/spinwheel/types";

const COLORS = [
  "#f44336",
  "#ff9800",
  "#ffca28",
  "#66bb6a",
  "#26a69a",
  "#42a5f5",
  "#5c6bc0",
  "#ab47bc",
  "#ec407a",
  "#78909c",
];

const DEFAULT_ENTRIES = [
  "Alice",
  "Bob",
  "Charlie",
  "David",
  "Emma",
  "Frank",
  "Grace",
  "Harry",
];

function makeEntries(text: string): WheelEntry[] {
  return text
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((text, index) => ({
      id: `${Date.now()}-${index}-${Math.random()}`,
      text,
      color: COLORS[index % COLORS.length],
    }));
}

export default function SpinWheel() {
  const [entriesText, setEntriesText] = useState(DEFAULT_ENTRIES.join("\n"));
  const [results, setResults] = useState<string[]>([]);
  const [winner, setWinner] = useState("");
  const [winnerOpen, setWinnerOpen] = useState(false);
  const [spinning, setSpinning] = useState(false);

  const wheelRef = useRef<WheelHandle>(null);

  const entries = useMemo(
    () => makeEntries(entriesText),
    [entriesText],
  );

  const spin = useCallback(() => {
    if (spinning || entries.length === 0) return;
    setSpinning(true);
    wheelRef.current?.spin();
  }, [entries.length, spinning]);

  const handleWinner = useCallback((entry: WheelEntry) => {
    setSpinning(false);
    setWinner(entry.text);
    setResults((current) => [entry.text, ...current]);
    setWinnerOpen(true);
  }, []);

  const shuffle = useCallback(() => {
    const lines = entriesText.split(/\r?\n/).filter((line) => line.trim());
    for (let i = lines.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [lines[i], lines[j]] = [lines[j], lines[i]];
    }
    setEntriesText(lines.join("\n"));
  }, [entriesText]);

  const sort = useCallback(() => {
    const lines = entriesText
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

    setEntriesText(lines.join("\n"));
  }, [entriesText]);

  const clear = useCallback(() => {
    setEntriesText("");
  }, []);

  const removeWinner = useCallback(() => {
    if (!winner) return;

    const lines = entriesText.split(/\r?\n/);
    const index = lines.findIndex((line) => line.trim() === winner.trim());

    if (index !== -1) {
      lines.splice(index, 1);
      setEntriesText(lines.join("\n"));
    }

    setWinnerOpen(false);
  }, [entriesText, winner]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.ctrlKey &&
        event.key === "Enter" &&
        !event.repeat &&
        !spinning
      ) {
        event.preventDefault();
        spin();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [spin, spinning]);

  return (
    <div className="flex h-screen min-h-[620px] w-full flex-col overflow-hidden bg-[#f5f5f5] text-[#333]">
      <header className="flex min-h-14 shrink-0 items-center justify-between border-b bg-white px-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#5dade2] text-lg font-bold text-white">
            W
          </div>
          <span className="text-lg font-semibold tracking-tight">
            Wheel of Names
          </span>
        </div>

        <Button variant="ghost" size="sm">
          <Settings2 className="mr-2 h-4 w-4" />
          Customize
        </Button>
      </header>

      <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section className="relative min-h-0 flex-1 overflow-hidden bg-[#f5f5f5]">
          <div className="absolute left-4 top-4 z-20 hidden rounded-md bg-white/90 px-3 py-2 text-xs text-muted-foreground shadow-sm backdrop-blur md:block">
            Click SPIN or press Ctrl + Enter
          </div>

          <Wheel
            ref={wheelRef}
            entries={entries}
            spinning={spinning}
            onSpinStart={() => setSpinning(true)}
            onWinner={handleWinner}
          />
        </section>

        <WheelSidebar
          entriesText={entriesText}
          results={results}
          spinning={spinning}
          onEntriesChange={setEntriesText}
          onShuffle={shuffle}
          onSort={sort}
          onClear={clear}
          onSpin={spin}
        />
      </main>

      <WinnerDialog
        open={winnerOpen}
        winner={winner}
        onOpenChange={setWinnerOpen}
        onRemove={removeWinner}
      />
    </div>
  );
}
