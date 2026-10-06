import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, RotateCw, Shuffle, ArrowDownAZ, MoreVertical, Download, Trash2 } from "lucide-react";
import type { WheelConfig } from "@/pages/SpinWheel";

type Props = {
  tab: "entries" | "results";
  setTab: (tab: "entries" | "results") => void;
  entriesText: string;
  results: string[];
  onEntriesChange: (value: string) => void;
  onShuffle: () => void;
  onSort: () => void;
  onAddWheel: () => void;
  onRemoveWheel: () => void;
  wheelCount: number;
  activeWheel: number;
  setActiveWheel: (index: number) => void;
  config: WheelConfig;
  updateConfig: (patch: Partial<WheelConfig>) => void;
  onClearResults: () => void;
};

export function WheelSidebar({
  tab, setTab, entriesText, results, onEntriesChange, onShuffle, onSort,
  onAddWheel, onRemoveWheel, wheelCount, activeWheel, setActiveWheel,
  config, updateConfig, onClearResults,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const exportResults = () => {
    const blob = new Blob([results.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "wheel-results.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <aside className="wheel-sidebar">
      <div className="wheel-tabs-row">
        <Tabs value={tab} onValueChange={(value) => setTab(value as "entries" | "results")} className="flex-1">
          <TabsList className="w-full">
            <TabsTrigger value="entries" className="flex-1">Entries</TabsTrigger>
            <TabsTrigger value="results" className="flex-1">Results</TabsTrigger>
          </TabsList>
        </Tabs>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="More options">
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => fileRef.current?.click()}>
              Import entries
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportResults}>
              <Download className="mr-2 size-4" /> Export results
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onClearResults}>Clear results</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.csv"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            file.text().then(onEntriesChange);
            event.target.value = "";
          }}
        />
      </div>

      {tab === "entries" ? (
        <>
          <Textarea
            value={entriesText}
            onChange={(event) => onEntriesChange(event.target.value)}
            className="wheel-entry-editor"
            placeholder={"Enter one entry per line..."}
            spellCheck={false}
          />

          <div className="wheel-editor-actions">
            <Button variant="outline" size="sm" onClick={onShuffle}>
              <Shuffle className="mr-2 size-4" /> Shuffle
            </Button>
            <Button variant="outline" size="sm" onClick={onSort}>
              <ArrowDownAZ className="mr-2 size-4" /> Sort
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              Add image
            </Button>
          </div>
        </>
      ) : (
        <div className="wheel-results">
          {results.length ? results.map((result, index) => (
            <div className="wheel-result-row" key={`${result}-${index}`}>
              <span>{results.length - index}.</span>
              <strong>{result}</strong>
            </div>
          )) : (
            <div className="wheel-empty">No results yet.</div>
          )}
        </div>
      )}

      <div className="wheel-sidebar-divider" />

      <div className="wheel-control-row">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            for (let i = 0; i < wheelCount; i += 1) {
              setActiveWheel(i);
            }
          }}
        >
          <RotateCw className="mr-2 size-4" /> Spin all wheels
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 size-4" /> Add wheel
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onAddWheel}>New blank wheel</DropdownMenuItem>
            <DropdownMenuItem onClick={onAddWheel}>Open wheel</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {wheelCount > 1 && (
        <div className="wheel-list">
          {Array.from({ length: wheelCount }, (_, index) => (
            <div key={index} className={`wheel-list-item ${activeWheel === index ? "active" : ""}`}>
              <button onClick={() => setActiveWheel(index)}>Wheel {index + 1}</button>
              <button
                className="wheel-list-delete"
                onClick={onRemoveWheel}
                aria-label={`Remove wheel ${index + 1}`}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="wheel-advanced">
        <div className="wheel-advanced-title">Advanced</div>

        <label className="wheel-setting">
          <span>Allow duplicates</span>
          <Switch checked={config.allowDuplicates} onCheckedChange={(checked) => updateConfig({ allowDuplicates: checked })} />
        </label>

        <label className="wheel-setting">
          <span>Auto-remove winner after 5 seconds</span>
          <Switch checked={config.autoRemoveWinner} onCheckedChange={(checked) => updateConfig({ autoRemoveWinner: checked })} />
        </label>

        <label className="wheel-setting">
          <span>Pointer changes color</span>
          <Switch checked={config.pointerChangesColor} onCheckedChange={(checked) => updateConfig({ pointerChangesColor: checked })} />
        </label>

        <div className="wheel-setting-input">
          <span>Spin time</span>
          <Input
            type="number"
            min={1}
            max={60}
            value={config.spinTime}
            onChange={(event) => updateConfig({ spinTime: Math.max(1, Math.min(60, Number(event.target.value) || 1)) })}
            className="w-20"
          />
          <span>sec</span>
        </div>
      </div>
    </aside>
  );
}
