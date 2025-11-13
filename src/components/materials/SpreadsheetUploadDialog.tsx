import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

interface SpreadsheetUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SpreadsheetUploadDialog = ({ open, onOpenChange }: SpreadsheetUploadDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar Planilha</DialogTitle>
        </DialogHeader>
        <div className="text-center py-8">
          <Upload className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Funcionalidade em desenvolvimento</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
