import { Trophy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type WinnerDialogProps = {
  open: boolean;
  winner: string;
  onOpenChange: (open: boolean) => void;
  onRemove: () => void;
};

export function WinnerDialog({
  open,
  winner,
  onOpenChange,
  onRemove,
}: WinnerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-[#5dade2] text-white">
            <Trophy className="h-7 w-7" />
          </div>
          <DialogTitle className="text-2xl">
            We have a winner!
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-xl bg-[#5dade2] px-5 py-8 text-center text-3xl font-bold text-white shadow-inner">
          {winner}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={onRemove}>Remove</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
