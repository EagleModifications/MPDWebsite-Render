import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function WinnerDialog({
  winner,
  onClose,
}: {
  winner: string | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={Boolean(winner)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="winner-dialog">
        <DialogHeader>
          <DialogTitle className="winner-dialog-title">Winner</DialogTitle>
        </DialogHeader>
        <div className="winner-dialog-name">{winner}</div>
      </DialogContent>
    </Dialog>
  );
}
