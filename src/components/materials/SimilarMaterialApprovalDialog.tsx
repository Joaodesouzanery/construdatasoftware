import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, SkipForward } from "lucide-react";

interface SimilarMaterial {
  material: {
    id: string;
    name: string;
    brand?: string;
    category?: string;
    material_price?: number;
    labor_price?: number;
    unit?: string;
    measurement?: string;
  };
  similarity: number;
  matchType: string;
}

interface PendingApproval {
  index: number;
  description: string;
  match: SimilarMaterial;
}

interface SimilarMaterialApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: PendingApproval | null;
  onApprove: () => void;
  onReject: () => void;
  onSkip: () => void;
  totalPending: number;
  currentIndex: number;
}

export function SimilarMaterialApprovalDialog({
  open,
  onOpenChange,
  pending,
  onApprove,
  onReject,
  onSkip,
  totalPending,
  currentIndex,
}: SimilarMaterialApprovalDialogProps) {
  if (!pending) return null;

  const { description, match } = pending;
  const material = match.material;
  const totalPrice = (material.material_price || 0) + (material.labor_price || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Confirmar Material Similar</span>
            <Badge variant="outline">
              {currentIndex + 1} de {totalPending}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Encontramos um material similar. Por favor, confirme se deseja usar este preço.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-4 border rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground mb-1">Descrição na planilha:</p>
            <p className="font-medium">{description}</p>
          </div>

          <div className="flex items-center justify-center">
            <span className="text-muted-foreground">↓</span>
          </div>

          <div className="p-4 border rounded-lg border-primary/50 bg-primary/5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Material encontrado:</p>
              <Badge 
                variant={match.matchType === 'Exato' ? 'default' : 
                        match.matchType === 'Parcial' ? 'secondary' : 'outline'}
              >
                {match.matchType === 'Similaridade' 
                  ? `${match.similarity.toFixed(0)}% similar` 
                  : match.matchType}
              </Badge>
            </div>
            <p className="font-semibold text-lg">{material.name}</p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
              {material.brand && (
                <div>
                  <p className="text-muted-foreground">Marca</p>
                  <p className="font-medium">{material.brand}</p>
                </div>
              )}
              {material.category && (
                <div>
                  <p className="text-muted-foreground">Categoria</p>
                  <p className="font-medium">{material.category}</p>
                </div>
              )}
              {material.measurement && (
                <div>
                  <p className="text-muted-foreground">Medida</p>
                  <p className="font-medium">{material.measurement}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground">Unidade</p>
                <p className="font-medium">{material.unit || 'UN'}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 mt-4 pt-3 border-t">
              <div>
                <p className="text-xs text-muted-foreground">Material</p>
                <p className="text-blue-600 font-semibold">
                  R$ {(material.material_price || 0).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Mão de Obra</p>
                <p className="text-orange-600 font-semibold">
                  R$ {(material.labor_price || 0).toFixed(2)}
                </p>
              </div>
              <div className="ml-auto">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-green-600 font-bold text-lg">
                  R$ {totalPrice.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onSkip} className="sm:mr-auto">
            <SkipForward className="h-4 w-4 mr-2" />
            Pular
          </Button>
          <Button variant="destructive" onClick={onReject}>
            <X className="h-4 w-4 mr-2" />
            Não é esse
          </Button>
          <Button onClick={onApprove}>
            <Check className="h-4 w-4 mr-2" />
            Sim, usar este
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
