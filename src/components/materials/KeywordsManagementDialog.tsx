import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Download, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface KeywordsManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const KeywordsManagementDialog = ({ open, onOpenChange }: KeywordsManagementDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newKeyword, setNewKeyword] = useState({ type: 'brand', value: '' });

  const { data: keywords, isLoading } = useQuery({
    queryKey: ['custom-keywords'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_keywords')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    }
  });

  const addMutation = useMutation({
    mutationFn: async (keyword: { type: string; value: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase.from('custom_keywords').insert({
        keyword_type: keyword.type,
        keyword_value: keyword.value,
        created_by_user_id: user.id
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-keywords'] });
      toast({ title: "Palavra-chave adicionada!" });
      setNewKeyword({ type: 'brand', value: '' });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao adicionar palavra-chave",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('custom_keywords')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-keywords'] });
      toast({ title: "Palavra-chave removida!" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover palavra-chave",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const exportKeywords = () => {
    const json = JSON.stringify(keywords, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'palavras-chave.json';
    a.click();
  };

  const importKeywords = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        const toInsert = imported.map((k: any) => ({
          keyword_type: k.keyword_type,
          keyword_value: k.keyword_value,
          created_by_user_id: user.id
        }));

        const { error } = await supabase.from('custom_keywords').insert(toInsert);
        if (error) throw error;

        queryClient.invalidateQueries({ queryKey: ['custom-keywords'] });
        toast({ title: "Palavras-chave importadas!" });
      } catch (error: any) {
        toast({
          title: "Erro ao importar",
          description: error.message,
          variant: "destructive"
        });
      }
    };
    reader.readAsText(file);
  };

  const keywordsByType = keywords?.reduce((acc: any, keyword: any) => {
    if (!acc[keyword.keyword_type]) acc[keyword.keyword_type] = [];
    acc[keyword.keyword_type].push(keyword);
    return acc;
  }, {}) || {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar Palavras-chave</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportKeywords} disabled={!keywords?.length}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            <Button variant="outline" asChild>
              <label>
                <Upload className="h-4 w-4 mr-2" />
                Importar
                <input type="file" accept=".json" className="hidden" onChange={importKeywords} />
              </label>
            </Button>
          </div>

          <div className="space-y-4 border rounded-lg p-4">
            <h3 className="font-medium">Adicionar Nova Palavra-chave</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Tipo *</Label>
                <Select
                  value={newKeyword.type}
                  onValueChange={(value) => setNewKeyword({ ...newKeyword, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="brand">Marca</SelectItem>
                    <SelectItem value="color">Cor</SelectItem>
                    <SelectItem value="unit">Unidade</SelectItem>
                    <SelectItem value="general">Geral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Palavra-chave *</Label>
                <Input
                  value={newKeyword.value}
                  onChange={(e) => setNewKeyword({ ...newKeyword, value: e.target.value })}
                  placeholder="Ex: Tigre, Branco, kg..."
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={() => addMutation.mutate(newKeyword)}
                  disabled={!newKeyword.value || addMutation.isPending}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Estas palavras-chave serão usadas para identificar automaticamente materiais em planilhas importadas.
              A IA reconhece sinônimos e variações (ex: "Tigre", "tigre", "TIGRE").
            </p>
          </div>

          <div className="space-y-4">
            {Object.entries(keywordsByType).map(([type, typeKeywords]: [string, any]) => (
              <div key={type} className="space-y-2">
                <h3 className="font-medium capitalize">
                  {type === 'brand' ? 'Marcas' : type === 'color' ? 'Cores' : type === 'unit' ? 'Unidades' : 'Gerais'}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {typeKeywords.map((keyword: any) => (
                    <Badge key={keyword.id} variant="secondary" className="flex items-center gap-2">
                      {keyword.keyword_value}
                      <button
                        onClick={() => deleteMutation.mutate(keyword.id)}
                        className="ml-1 hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {isLoading && (
            <div className="text-center py-4 text-muted-foreground">Carregando...</div>
          )}

          {!isLoading && keywords?.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma palavra-chave cadastrada
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
