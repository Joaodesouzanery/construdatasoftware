import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import JSZip from "jszip";
import { supabase } from "@/lib/supabase";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  MapPin,
  Layers,
  Users,
  Plus,
  X,
  Save,
  Eye,
  EyeOff,
  Trash2,
  Edit,
  Square,
  Circle,
  Hexagon,
  FileCode,
  Map,
  Loader2,
  FileArchive,
  ArrowLeft,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

interface MapAnnotation {
  id: string;
  project_id: string;
  latitude: number;
  longitude: number;
  tipo: string;
  descricao?: string;
  porcentagem: number;
  team_id?: string;
  service_front_id?: string;
  created_at: string;
}

export default function InteractiveMap() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showAddMarkerDialog, setShowAddMarkerDialog] = useState(false);
  const [newMarker, setNewMarker] = useState({
    latitude: 0,
    longitude: 0,
    tipo: "ponto",
    descricao: "",
    porcentagem: 0,
    team_id: "",
    service_front_id: "",
  });
  const [activeTab, setActiveTab] = useState("map");

  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const { data: project, isLoading: loadingProject } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId && !!session,
  });

  const { data: annotations = [] } = useQuery({
    queryKey: ["map-annotations", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("map_annotations")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as MapAnnotation[];
    },
    enabled: !!projectId && !!session,
  });

  const { data: serviceFronts = [] } = useQuery({
    queryKey: ["service-fronts", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data } = await supabase
        .from("service_fronts")
        .select("id, name")
        .eq("project_id", projectId);
      return data || [];
    },
    enabled: !!projectId && !!session,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-project", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data } = await supabase
        .from("employees")
        .select("id, name")
        .eq("project_id", projectId)
        .eq("status", "active");
      return data || [];
    },
    enabled: !!projectId && !!session,
  });

  const uploadMapMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!session?.user?.id || !projectId) throw new Error("Usuário ou projeto não encontrado");

      setIsUploading(true);
      setUploadProgress(10);

      // Read and extract ZIP file
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(file);
      
      setUploadProgress(30);

      // Find index.html
      let indexHtmlPath: string | null = null;
      const filesToUpload: { path: string; content: Blob }[] = [];

      for (const [relativePath, zipEntry] of Object.entries(zipContent.files)) {
        if (!zipEntry.dir) {
          const content = await zipEntry.async("blob");
          filesToUpload.push({ path: relativePath, content });
          
          if (relativePath.toLowerCase().endsWith("index.html") || 
              relativePath.toLowerCase() === "index.html") {
            indexHtmlPath = relativePath;
          }
        }
      }

      if (!indexHtmlPath) {
        throw new Error("Arquivo index.html não encontrado no ZIP");
      }

      setUploadProgress(50);

      // Delete existing files for this project
      const { data: existingFiles } = await supabase.storage
        .from("interactive-maps")
        .list(projectId);

      if (existingFiles && existingFiles.length > 0) {
        const filesToDelete = existingFiles.map(f => `${projectId}/${f.name}`);
        await supabase.storage.from("interactive-maps").remove(filesToDelete);
      }

      setUploadProgress(60);

      // Upload all files
      let uploadedCount = 0;
      for (const { path, content } of filesToUpload) {
        const storagePath = `${projectId}/${path}`;
        const { error } = await supabase.storage
          .from("interactive-maps")
          .upload(storagePath, content, { upsert: true });
        
        if (error) {
          console.error(`Erro ao enviar ${path}:`, error);
        }
        
        uploadedCount++;
        setUploadProgress(60 + (uploadedCount / filesToUpload.length) * 30);
      }

      setUploadProgress(95);

      // Get public URL for index.html
      const { data: publicUrlData } = supabase.storage
        .from("interactive-maps")
        .getPublicUrl(`${projectId}/${indexHtmlPath}`);

      const mapUrl = publicUrlData.publicUrl;

      // Update project with map URL
      const { error: updateError } = await supabase
        .from("projects")
        .update({ interactive_map_url: mapUrl })
        .eq("id", projectId);

      if (updateError) throw updateError;

      setUploadProgress(100);
      return mapUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      toast({
        title: "Mapa enviado!",
        description: "O mapa interativo foi carregado com sucesso.",
      });
      setIsUploading(false);
      setUploadProgress(0);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao enviar mapa",
        description: error.message || "Não foi possível processar o arquivo ZIP.",
        variant: "destructive",
      });
      setIsUploading(false);
      setUploadProgress(0);
    },
  });

  const addAnnotationMutation = useMutation({
    mutationFn: async (data: typeof newMarker) => {
      if (!session?.user?.id || !projectId) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("map_annotations")
        .insert({
          project_id: projectId,
          latitude: data.latitude,
          longitude: data.longitude,
          tipo: data.tipo,
          descricao: data.descricao || null,
          porcentagem: data.porcentagem,
          team_id: data.team_id || null,
          service_front_id: data.service_front_id || null,
          created_by_user_id: session.user.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["map-annotations", projectId] });
      toast({ title: "Anotação adicionada!" });
      setShowAddMarkerDialog(false);
      setNewMarker({
        latitude: 0,
        longitude: 0,
        tipo: "ponto",
        descricao: "",
        porcentagem: 0,
        team_id: "",
        service_front_id: "",
      });
    },
    onError: () => {
      toast({ title: "Erro ao adicionar anotação", variant: "destructive" });
    },
  });

  const deleteAnnotationMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("map_annotations")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["map-annotations", projectId] });
      toast({ title: "Anotação removida!" });
    },
  });

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".zip")) {
      toast({
        title: "Formato inválido",
        description: "Por favor, envie um arquivo ZIP exportado do QGIS (qgis2web).",
        variant: "destructive",
      });
      return;
    }

    uploadMapMutation.mutate(file);
  }, [uploadMapMutation, toast]);

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return "text-green-500";
    if (progress >= 50) return "text-yellow-500";
    return "text-red-500";
  };

  if (loadingProject) {
    return (
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <main className="flex-1 p-6 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </main>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 p-6">
          <div className="mb-6">
            <Button variant="ghost" onClick={() => navigate("/projects")} className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar aos Projetos
            </Button>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Map className="h-8 w-8" />
              Mapa Interativo
            </h1>
            <p className="text-muted-foreground">
              {project?.name || "Projeto"} - Importe mapas do QGIS e gerencie anotações
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="map">
                <Map className="h-4 w-4 mr-2" />
                Mapa
              </TabsTrigger>
              <TabsTrigger value="annotations">
                <MapPin className="h-4 w-4 mr-2" />
                Anotações ({annotations.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="map" className="space-y-4">
              {/* Upload Area or Map Display */}
              {!project?.interactive_map_url ? (
                <Card className="border-dashed border-2">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <FileArchive className="h-16 w-16 text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold mb-2">Enviar Mapa do QGIS</h3>
                    <p className="text-muted-foreground text-center mb-6 max-w-md">
                      Exporte seu projeto do QGIS usando o plugin <strong>qgis2web</strong> e 
                      envie o arquivo ZIP gerado.
                    </p>
                    
                    {isUploading ? (
                      <div className="w-full max-w-xs space-y-2">
                        <Progress value={uploadProgress} />
                        <p className="text-sm text-center text-muted-foreground">
                          Processando... {uploadProgress}%
                        </p>
                      </div>
                    ) : (
                      <>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".zip"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                        <Button size="lg" onClick={() => fileInputRef.current?.click()}>
                          <Upload className="h-4 w-4 mr-2" />
                          Selecionar Arquivo ZIP
                        </Button>
                      </>
                    )}

                    <div className="mt-8 text-left bg-muted/50 p-4 rounded-lg max-w-lg">
                      <h4 className="font-semibold mb-2">Como exportar do QGIS:</h4>
                      <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                        <li>Instale o plugin qgis2web no QGIS</li>
                        <li>Vá em Web → qgis2web → Create web map</li>
                        <li>Escolha Leaflet como formato de exportação</li>
                        <li>Exporte e compacte a pasta em ZIP</li>
                        <li>Envie o arquivo ZIP aqui</li>
                      </ol>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">
                      <Map className="h-3 w-3 mr-1" />
                      Mapa carregado
                    </Badge>
                    <div className="flex gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".zip"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Substituir Mapa
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setShowAddMarkerDialog(true)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Nova Anotação
                      </Button>
                    </div>
                  </div>

                  {isUploading && (
                    <div className="space-y-2">
                      <Progress value={uploadProgress} />
                      <p className="text-sm text-center text-muted-foreground">
                        Processando... {uploadProgress}%
                      </p>
                    </div>
                  )}

                  <Card className="overflow-hidden">
                    <iframe
                      ref={iframeRef}
                      src={project.interactive_map_url}
                      className="w-full h-[600px] border-0"
                      title="Mapa Interativo"
                    />
                  </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="annotations" className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Anotações do Mapa</h2>
                <Button onClick={() => setShowAddMarkerDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Anotação
                </Button>
              </div>

              {annotations.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma anotação adicionada ainda.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {annotations.map((annotation) => (
                    <Card key={annotation.id}>
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center justify-between text-base">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            {annotation.tipo}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteAnnotationMutation.mutate(annotation.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {annotation.descricao && (
                          <p className="text-sm text-muted-foreground">{annotation.descricao}</p>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="text-sm">Avanço:</span>
                          <span className={`font-bold ${getProgressColor(annotation.porcentagem)}`}>
                            {annotation.porcentagem}%
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Lat: {annotation.latitude.toFixed(6)}, Lng: {annotation.longitude.toFixed(6)}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Add Annotation Dialog */}
          <Dialog open={showAddMarkerDialog} onOpenChange={setShowAddMarkerDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Anotação no Mapa</DialogTitle>
                <DialogDescription>
                  Adicione uma anotação com coordenadas e informações de progresso.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Latitude</Label>
                    <Input
                      type="number"
                      step="0.000001"
                      value={newMarker.latitude}
                      onChange={(e) => setNewMarker({ ...newMarker, latitude: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Longitude</Label>
                    <Input
                      type="number"
                      step="0.000001"
                      value={newMarker.longitude}
                      onChange={(e) => setNewMarker({ ...newMarker, longitude: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select
                    value={newMarker.tipo}
                    onValueChange={(v) => setNewMarker({ ...newMarker, tipo: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ponto">Ponto</SelectItem>
                      <SelectItem value="area">Área</SelectItem>
                      <SelectItem value="setor">Setor</SelectItem>
                      <SelectItem value="inspecao">Inspeção</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea
                    value={newMarker.descricao}
                    onChange={(e) => setNewMarker({ ...newMarker, descricao: e.target.value })}
                    placeholder="Descrição da anotação..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Avanço (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={newMarker.porcentagem}
                    onChange={(e) => setNewMarker({ ...newMarker, porcentagem: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                {serviceFronts.length > 0 && (
                  <div className="space-y-2">
                    <Label>Frente de Serviço (Opcional)</Label>
                    <Select
                      value={newMarker.service_front_id}
                      onValueChange={(v) => setNewMarker({ ...newMarker, service_front_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Nenhum</SelectItem>
                        {serviceFronts.map((sf: any) => (
                          <SelectItem key={sf.id} value={sf.id}>{sf.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddMarkerDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={() => addAnnotationMutation.mutate(newMarker)}>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </SidebarProvider>
  );
}
