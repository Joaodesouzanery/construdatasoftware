import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface CreateBudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget?: any;
}

export const CreateBudgetDialog = ({ open, onOpenChange, budget }: CreateBudgetDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{budget ? "Editar" : "Novo"} Orçamento</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground">Funcionalidade em desenvolvimento</p>
      </DialogContent>
    </Dialog>
  );
};
