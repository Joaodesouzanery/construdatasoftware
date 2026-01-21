import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Search, AlertTriangle, Trash2, Merge, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface DuplicateGroup {
  id: string;
  primaryMaterial: any;
  duplicates: any[];
  matchScore: number;
  matchedTokens: string[];
}

export const DuplicateMaterialsReport = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [minScore, setMinScore] = useState(70);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [mergingGroup, setMergingGroup] = useState<DuplicateGroup | null>(null);
  const [keepMaterialId, setKeepMaterialId] = useState<string>("");

  const { data: materials = [], isLoading, refetch } = useQuery({
    queryKey: ['materials-duplicates-analysis'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('materials')
        .select('id, name, unit, keywords, keywords_norm, material_price, labor_price, current_price, category, supplier, measurement')
        .order('name');
      
      if (error) throw error;
      return data || [];
    }
  });

  // Analisa materiais duplicados baseado em keywords_norm
  const duplicateGroups = useMemo(() => {
    if (materials.length === 0) return [];

    const groups: DuplicateGroup[] = [];
    const processedIds = new Set<string>();

    for (let i = 0; i < materials.length; i++) {
      const material = materials[i];
      if (processedIds.has(material.id)) continue;

      const materialTokens = material.keywords_norm || [];
      if (materialTokens.length === 0) continue;

      const duplicates: any[] = [];
      let bestMatchScore = 0;
      let bestMatchedTokens: string[] = [];

      for (let j = i + 1; j < materials.length; j++) {
        const candidate = materials[j];
        if (processedIds.has(candidate.id)) continue;

        const candidateTokens = candidate.keywords_norm || [];
        if (candidateTokens.length === 0) continue;

        // Calcula overlap de tokens
        const commonTokens = materialTokens.filter((t: string) => candidateTokens.includes(t));
        const overlapCount = commonTokens.length;
        const overlapPercentage = overlapCount / Math.min(materialTokens.length, candidateTokens.length);

        // Score de matching
        let score = 0;
        if (overlapCount >= 3) {
          score = 90;
        } else if (overlapCount >= 2 || overlapPercentage >= 0.6) {
          score = 70 + overlapCount * 5;
        } else if (overlapCount >= 1 && overlapPercentage >= 0.5) {
          score = 50 + overlapCount * 10;
        }

        // Bonus se unidade for igual
        if (material.unit?.toLowerCase() === candidate.unit?.toLowerCase()) {
          score += 10;
        }

        if (score >= minScore) {
          duplicates.push({ ...candidate, matchScore: score, matchedTokens: commonTokens });
          processedIds.add(candidate.id);

          if (score > bestMatchScore) {
            bestMatchScore = score;
            bestMatchedTokens = commonTokens;
          }
        }
      }

      if (duplicates.length > 0) {
        groups.push({
          id: material.id,
          primaryMaterial: material,
          duplicates: duplicates.sort((a, b) => b.matchScore - a.matchScore),
          matchScore: bestMatchScore,
          matchedTokens: bestMatchedTokens,
        });
        processedIds.add(material.id);
      }
    }

    return groups.sort((a, b) => b.matchScore - a.matchScore);
  }, [materials, minScore]);

  // Filtra por termo de busca
  const filteredGroups = useMemo(() => {
    if (!searchTerm) return duplicateGroups;
    const term = searchTerm.toLowerCase();
    return duplicateGroups.filter(group => 
      group.primaryMaterial.name.toLowerCase().includes(term) ||
      group.duplicates.some(d => d.name.toLowerCase().includes(term))
    );
  }, [duplicateGroups, searchTerm]);

  // Mutation para deletar materiais
  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('materials')
        .delete()
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      queryClient.invalidateQueries({ queryKey: ['materials-duplicates-analysis'] });
      toast({ title: "Materiais removidos com sucesso" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao remover materiais", description: error.message, variant: "destructive" });
    }
  });

  // Função para mesclar duplicados (mantém um, deleta os outros)
  const handleMerge = async () => {
    if (!mergingGroup || !keepMaterialId) return;

    const idsToDelete = [
      mergingGroup.primaryMaterial.id,
      ...mergingGroup.duplicates.map(d => d.id)
    ].filter(id => id !== keepMaterialId);

    await deleteMutation.mutateAsync(idsToDelete);
    setShowMergeDialog(false);
    setMergingGroup(null);
    setKeepMaterialId("");
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const toggleSelectGroup = (groupId: string) => {
    setSelectedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const openMergeDialog = (group: DuplicateGroup) => {
    setMergingGroup(group);
    setKeepMaterialId(group.primaryMaterial.id);
    setShowMergeDialog(true);
  };

  const totalDuplicates = duplicateGroups.reduce((acc, g) => acc + g.duplicates.length, 0);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">Analisando catálogo...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Relatório de Duplicados Potenciais
          </CardTitle>
          <CardDescription>
            Análise de materiais que podem ser duplicados baseada em palavras-chave similares.
            {duplicateGroups.length > 0 && (
              <span className="block mt-1 font-medium text-amber-600">
                Encontrados {duplicateGroups.length} grupos com {totalDuplicates} possíveis duplicados
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar materiais..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">Score mínimo:</span>
              <Input
                type="number"
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className="w-20"
                min={30}
                max={100}
              />
            </div>
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reanalizar
            </Button>
          </div>

          {filteredGroups.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Nenhum duplicado encontrado</p>
              <p className="text-sm">Seu catálogo parece estar limpo! Tente reduzir o score mínimo para uma análise mais ampla.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredGroups.map((group) => (
                <Collapsible
                  key={group.id}
                  open={expandedGroups.has(group.id)}
                  onOpenChange={() => toggleGroup(group.id)}
                >
                  <div className="border rounded-lg overflow-hidden">
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                        <Checkbox
                          checked={selectedGroups.has(group.id)}
                          onCheckedChange={() => toggleSelectGroup(group.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        {expandedGroups.has(group.id) ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium truncate">{group.primaryMaterial.name}</p>
                            <Badge variant="outline" className="text-xs">
                              {group.primaryMaterial.unit}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge 
                              variant={group.matchScore >= 90 ? "destructive" : group.matchScore >= 70 ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {group.matchScore}% match
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {group.duplicates.length} possível(is) duplicado(s)
                            </span>
                            {group.matchedTokens.length > 0 && (
                              <span className="text-xs text-muted-foreground">
                                • Tokens: {group.matchedTokens.slice(0, 3).join(', ')}
                                {group.matchedTokens.length > 3 && ` +${group.matchedTokens.length - 3}`}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openMergeDialog(group);
                          }}
                        >
                          <Merge className="h-4 w-4 mr-2" />
                          Mesclar
                        </Button>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="border-t bg-muted/30">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[40%]">Material</TableHead>
                              <TableHead>Unidade</TableHead>
                              <TableHead>Preço</TableHead>
                              <TableHead>Match</TableHead>
                              <TableHead>Tokens Comuns</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow className="bg-primary/5">
                              <TableCell className="font-medium">
                                {group.primaryMaterial.name}
                                <Badge variant="outline" className="ml-2 text-xs">Principal</Badge>
                              </TableCell>
                              <TableCell>{group.primaryMaterial.unit}</TableCell>
                              <TableCell>
                                R$ {((group.primaryMaterial.material_price || 0) + (group.primaryMaterial.labor_price || 0)).toFixed(2)}
                              </TableCell>
                              <TableCell>-</TableCell>
                              <TableCell>
                                {(group.primaryMaterial.keywords_norm || []).slice(0, 5).join(', ')}
                              </TableCell>
                            </TableRow>
                            {group.duplicates.map((dup) => (
                              <TableRow key={dup.id}>
                                <TableCell className="font-medium">{dup.name}</TableCell>
                                <TableCell>{dup.unit}</TableCell>
                                <TableCell>
                                  R$ {((dup.material_price || 0) + (dup.labor_price || 0)).toFixed(2)}
                                </TableCell>
                                <TableCell>
                                  <Badge 
                                    variant={dup.matchScore >= 90 ? "destructive" : dup.matchScore >= 70 ? "default" : "secondary"}
                                    className="text-xs"
                                  >
                                    {dup.matchScore}%
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {dup.matchedTokens?.join(', ')}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Merge Dialog */}
      <Dialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Mesclar Materiais Duplicados</DialogTitle>
            <DialogDescription>
              Selecione qual material manter. Os outros serão removidos do catálogo.
            </DialogDescription>
          </DialogHeader>
          
          {mergingGroup && (
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Escolha o material que deseja manter. Os demais serão excluídos permanentemente.
              </p>
              
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {/* Material principal */}
                <div
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    keepMaterialId === mergingGroup.primaryMaterial.id
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setKeepMaterialId(mergingGroup.primaryMaterial.id)}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={keepMaterialId === mergingGroup.primaryMaterial.id}
                      onCheckedChange={() => setKeepMaterialId(mergingGroup.primaryMaterial.id)}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{mergingGroup.primaryMaterial.name}</p>
                      <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                        <span>Unidade: {mergingGroup.primaryMaterial.unit}</span>
                        <span>Preço: R$ {((mergingGroup.primaryMaterial.material_price || 0) + (mergingGroup.primaryMaterial.labor_price || 0)).toFixed(2)}</span>
                        {mergingGroup.primaryMaterial.category && (
                          <span>Categoria: {mergingGroup.primaryMaterial.category}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Duplicados */}
                {mergingGroup.duplicates.map((dup) => (
                  <div
                    key={dup.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      keepMaterialId === dup.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setKeepMaterialId(dup.id)}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={keepMaterialId === dup.id}
                        onCheckedChange={() => setKeepMaterialId(dup.id)}
                      />
                      <div className="flex-1">
                        <p className="font-medium">{dup.name}</p>
                        <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                          <span>Unidade: {dup.unit}</span>
                          <span>Preço: R$ {((dup.material_price || 0) + (dup.labor_price || 0)).toFixed(2)}</span>
                          {dup.category && <span>Categoria: {dup.category}</span>}
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {dup.matchScore}% match
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMergeDialog(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleMerge}
              disabled={!keepMaterialId || deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {deleteMutation.isPending ? 'Removendo...' : `Remover ${mergingGroup ? mergingGroup.duplicates.length : 0} Duplicado(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
