import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface KeywordsManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const KeywordsManagementDialog = ({ open, onOpenChange }: KeywordsManagementDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gerenciar Palavras-chave</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground">Funcionalidade em desenvolvimento</p>
      </DialogContent>
    </Dialog>
  );
};
