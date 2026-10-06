import { Shuffle, ArrowDownAZ, Trash2, Plus, Minus, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

type WheelSidebarProps = {
  entriesText: string;
  results: string[];
  spinning: boolean;
  onEntriesChange: (value: string) => void;
  onShuffle: () => void;
  onSort: () => void;
  onClear: () => void;
  onSpin: () => void;
};

export function WheelSidebar({
  entriesText,
  results,
  spinning,
  onEntriesChange,
  onShuffle,
  onSort,
  onClear,
  onSpin,
}: WheelSidebarProps) {
  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-l bg-background lg:w-[420px] xl:w-[468px]">
      <Tabs defaultValue="entries" className="flex min-h-0 flex-1 flex-col">
        <div className="border-b px-3 pt-3">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="entries">
              Entries
              <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">
                {entriesText.split("\n").filter(Boolean).length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="results">
              Results
              <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">
                {results.length}
              </span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="entries" className="m-0 flex min-h-0 flex-1 flex-col gap-3 p-3">
          <Textarea
            value={entriesText}
            onChange={(event) => onEntriesChange(event.target.value)}
            placeholder={"Alice\nBob\nCharlie\nDavid"}
            className="min-h-0 flex-1 resize-none font-mono text-sm leading-6"
            spellCheck={false}
          />

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={onShuffle}>
              <Shuffle className="mr-2 h-4 w-4" />
              Shuffle
            </Button>
            <Button variant="outline" onClick={onSort}>
              <ArrowDownAZ className="mr-2 h-4 w-4" />
              Sort
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={onClear}>
              <Trash2 className="mr-2 h-4 w-4" />
              Clear
            </Button>
            <Button
              onClick={onSpin}
              disabled={spinning || !entriesText.trim()}
              className="bg-[#5dade2] text-white hover:bg-[#4b9bd1]"
            >
              <Play className="mr-2 h-4 w-4 fill-current" />
              {spinning ? "Spinning…" : "Spin"}
            </Button>
          </div>

          <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
            <div className="mb-1 flex items-center gap-2 font-semibold text-foreground">
              <Plus className="h-3.5 w-3.5" />
              One entry per line
            </div>
            Empty lines are ignored. Use Ctrl + Enter to spin.
          </div>
        </TabsContent>

        <TabsContent value="results" className="m-0 min-h-0 flex-1 overflow-auto p-3">
          {results.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Winners will appear here.
            </div>
          ) : (
            <ol className="space-y-2">
              {results.map((result, index) => (
                <li
                  key={`${result}-${index}`}
                  className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2"
                >
                  <span className="w-7 text-center text-xs text-muted-foreground">
                    {index + 1}
                  </span>
                  <span className="flex-1 truncate">{result}</span>
                  <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                </li>
              ))}
            </ol>
          )}
        </TabsContent>
      </Tabs>
    </aside>
  );
}
