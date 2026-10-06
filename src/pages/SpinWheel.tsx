import { useCallback, useMemo, useState } from "react";
import { Wheel } from "@/components/spinwheel/Wheel";
import { WheelSidebar } from "@/components/spinwheel/WheelSidebar";
import { WinnerDialog } from "@/components/spinwheel/WinnerDialog";
import "@/components/spinwheel/spinwheel.css";

export type WheelEntry = {
  id: string;
  text: string;
  color?: string;
};

export type WheelConfig = {
  entries: WheelEntry[];
  spinTime: number;
  duringSpinSound: boolean;
  duringSpinSoundVolume: number;
  afterSpinSound: string;
  afterSpinSoundVolume: number;
  drawShadow: boolean;
  drawOutlines: boolean;
  pointerChangesColor: boolean;
  allowDuplicates: boolean;
  autoRemoveWinner: boolean;
  showTitle: boolean;
  title: string;
};

const DEFAULT_COLORS = ["#5DADE2", "#82E0AA", "#F7DC6F", "#AF7AC5"];

const createEntry = (text: string, index: number): WheelEntry => ({
  id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
  text,
  color: DEFAULT_COLORS[index % DEFAULT_COLORS.length],
});

const createDefaultConfig = (): WheelConfig => ({
  entries: ["Ali", "Beatriz", "Charles", "Diya", "Eric", "Fatima", "Gabriel", "Hanna"].map((text, index) => createEntry(text, index)),
  spinTime: 10,
  duringSpinSound: true,
  duringSpinSoundVolume: 50,
  afterSpinSound: "applause-sound-soft",
  afterSpinSoundVolume: 50,
  drawShadow: true,
  drawOutlines: false,
  pointerChangesColor: true,
  allowDuplicates: true,
  autoRemoveWinner: false,
  showTitle: true,
  title: "",
});

export default function SpinWheel() {
  const [wheels, setWheels] = useState<WheelConfig[]>([createDefaultConfig()]);
  const [activeWheel, setActiveWheel] = useState(0);
  const [tab, setTab] = useState<"entries" | "results">("entries");
  const [results, setResults] = useState<string[]>([]);
  const [winner, setWinner] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);

  const config = wheels[activeWheel];

  const updateConfig = useCallback((patch: Partial<WheelConfig>) => {
    setWheels((current) =>
      current.map((wheel, index) => index === activeWheel ? { ...wheel, ...patch } : wheel),
    );
  }, [activeWheel]);

  const updateEntries = useCallback((value: string) => {
    const lines = value.split(/\r?\n/);
    const entries = lines
      .map((text, index) => text.trim())
      .filter(Boolean)
      .slice(0, 1000)
      .map((text, index) => createEntry(text, index));

    updateConfig({ entries });
  }, [updateConfig]);

  const addWheel = useCallback(() => {
    setWheels((current) => [...current, {
      ...createDefaultConfig(),
      entries: [createEntry(" ", 0)],
      title: `Wheel ${current.length + 1}`,
    }]);
    setActiveWheel(wheels.length);
  }, [wheels.length]);

  const removeWheel = useCallback((index: number) => {
    if (wheels.length === 1) return;
    setWheels((current) => current.filter((_, i) => i !== index));
    setActiveWheel((current) => Math.min(current, wheels.length - 2));
  }, [wheels.length]);

  const shuffle = useCallback(() => {
    updateConfig({ entries: [...config.entries].sort(() => Math.random() - 0.5) });
  }, [config.entries, updateConfig]);

  const sortEntries = useCallback(() => {
    updateConfig({ entries: [...config.entries].sort((a, b) => a.text.localeCompare(b.text)) });
  }, [config.entries, updateConfig]);

  const handleWinner = useCallback((entry: WheelEntry) => {
    setResults((current) => [entry.text, ...current]);
    setWinner(entry.text);

    if (config.autoRemoveWinner) {
      updateConfig({ entries: config.entries.filter((item) => item.id !== entry.id) });
    }
  }, [config, updateConfig]);

  const entriesText = useMemo(() => config.entries.map((entry) => entry.text).join("\n"), [config.entries]);

  return (
    <div className="spin-wheel-page">
      <main className="spin-wheel-layout">
        <section className="spin-wheel-stage">
          {config.showTitle && config.title && (
            <h1 className="spin-wheel-title">{config.title}</h1>
          )}

          <div className="spin-wheel-canvas-wrap">
            <Wheel
              config={config}
              muted={muted}
              onWinner={handleWinner}
              onMute={() => setMuted((value) => !value)}
            />
          </div>

          {wheels.length > 1 && (
            <div className="spin-wheel-bottom-controls">
              {wheels.map((_, index) => (
                <button
                  key={index}
                  className={index === activeWheel ? "wheel-dot active" : "wheel-dot"}
                  onClick={() => setActiveWheel(index)}
                  aria-label={`Wheel ${index + 1}`}
                />
              ))}
            </div>
          )}
        </section>

        <WheelSidebar
          tab={tab}
          setTab={setTab}
          entriesText={entriesText}
          results={results}
          onEntriesChange={updateEntries}
          onShuffle={shuffle}
          onSort={sortEntries}
          onAddWheel={addWheel}
          onRemoveWheel={() => removeWheel(activeWheel)}
          wheelCount={wheels.length}
          activeWheel={activeWheel}
          setActiveWheel={setActiveWheel}
          config={config}
          updateConfig={updateConfig}
          onClearResults={() => setResults([])}
        />
      </main>

      <WinnerDialog winner={winner} onClose={() => setWinner(null)} />
    </div>
  );
}
