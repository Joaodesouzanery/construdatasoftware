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
  Plus,
  Save,
  Trash2,
  Map,
  Loader2,
  FileArchive,
  ArrowLeft,
  Code,
  Copy,
  ExternalLink,
  RefreshCw,
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
  const replaceInputRef = useRef<HTMLInputElement>(null);
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

  const uploadMapMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!session?.user?.id || !projectId) throw new Error("Usuário ou projeto não encontrado");

      setIsUploading(true);
      setUploadProgress(5);

      try {
        const zip = new JSZip();
        const zipContent = await zip.loadAsync(file);
        
        setUploadProgress(15);

        // Find main HTML file (prefer index.html, but accept any .html)
        let indexHtmlPath: string | null = null;
        let baseFolder = "";
        
        const allPaths = Object.keys(zipContent.files);
        
        // First try to find a file literally named index.html
        for (const path of allPaths) {
          const fileName = path.split("/").pop()?.toLowerCase();
          if (fileName === "index.html") {
            indexHtmlPath = path;
            const parts = path.split("/");
            if (parts.length > 1) {
              baseFolder = parts.slice(0, -1).join("/") + "/";
            }
            break;
          }
        }

        // If not found, fall back to the first .html file
        if (!indexHtmlPath) {
          for (const path of allPaths) {
            const fileName = path.split("/").pop()?.toLowerCase();
            if (fileName && fileName.endsWith(".html")) {
              indexHtmlPath = path;
              const parts = path.split("/");
              if (parts.length > 1) {
                baseFolder = parts.slice(0, -1).join("/") + "/";
              }
              break;
            }
          }
        }

        if (!indexHtmlPath) {
          throw new Error("Nenhum arquivo .html encontrado no ZIP. Certifique-se de exportar o mapa completo pelo qgis2web.");
        }

        setUploadProgress(25);

        // Collect all files to upload
        const filesToUpload: { path: string; content: ArrayBuffer; contentType: string }[] = [];

        for (const [relativePath, zipEntry] of Object.entries(zipContent.files)) {
          if (!zipEntry.dir) {
            try {
              const content = await zipEntry.async("arraybuffer");
              
              // Remove base folder from path
              let cleanPath = relativePath;
              if (baseFolder && relativePath.startsWith(baseFolder)) {
                cleanPath = relativePath.substring(baseFolder.length);
              }
              
              // Skip empty paths
              if (!cleanPath || cleanPath === "") continue;
              
              // Determine content type
              const ext = cleanPath.toLowerCase().split(".").pop() || "";
              const mimeTypes: Record<string, string> = {
                html: "text/html",
                htm: "text/html",
                css: "text/css",
                js: "application/javascript",
                mjs: "application/javascript",
                json: "application/json",
                geojson: "application/json",
                png: "image/png",
                jpg: "image/jpeg",
                jpeg: "image/jpeg",
                gif: "image/gif",
                svg: "image/svg+xml",
                ico: "image/x-icon",
                webp: "image/webp",
                woff: "font/woff",
                woff2: "font/woff2",
                ttf: "font/ttf",
                eot: "application/vnd.ms-fontobject",
                otf: "font/otf",
              };
              const contentType = mimeTypes[ext] || "application/octet-stream";
              
              filesToUpload.push({ path: cleanPath, content, contentType });
            } catch (err) {
              console.warn(`Não foi possível processar: ${relativePath}`, err);
            }
          }
        }

        if (filesToUpload.length === 0) {
          throw new Error("Nenhum arquivo válido encontrado no ZIP.");
        }

        setUploadProgress(35);

        // Delete existing files for this project
        try {
          const { data: existingFiles } = await supabase.storage
            .from("interactive-maps")
            .list(projectId);
          
          if (existingFiles && existingFiles.length > 0) {
            const filePaths = existingFiles.map(f => `${projectId}/${f.name}`);
            await supabase.storage.from("interactive-maps").remove(filePaths);
          }
        } catch (err) {
          console.warn("Erro ao limpar arquivos existentes:", err);
        }
        
        setUploadProgress(45);

        // Upload files in smaller batches
        const batchSize = 3;
        let uploadedCount = 0;
        let hasErrors = false;
        
        for (let i = 0; i < filesToUpload.length; i += batchSize) {
          const batch = filesToUpload.slice(i, i + batchSize);
          
          await Promise.all(
            batch.map(async ({ path, content, contentType }) => {
              const storagePath = `${projectId}/${path}`;
              const blob = new Blob([content], { type: contentType });
              
              const { error } = await supabase.storage
                .from("interactive-maps")
                .upload(storagePath, blob, { 
                  upsert: true,
                  contentType,
                });
              
              if (error) {
                console.error(`Erro ao enviar ${path}:`, error.message);
                hasErrors = true;
              }
            })
          );
          
          uploadedCount += batch.length;
          const progress = 45 + Math.round((uploadedCount / filesToUpload.length) * 45);
          setUploadProgress(Math.min(progress, 90));
        }

        if (hasErrors) {
          console.warn("Alguns arquivos não foram enviados, mas o mapa pode funcionar parcialmente.");
        }

        setUploadProgress(92);

        // Descobrir o caminho "limpo" do HTML principal (após remover pasta-base)
        let indexCleanPath = indexHtmlPath;
        if (baseFolder && indexHtmlPath.startsWith(baseFolder)) {
          indexCleanPath = indexHtmlPath.substring(baseFolder.length);
        }

        // Get the public URL for the main HTML file
        const { data: publicUrlData } = supabase.storage
          .from("interactive-maps")
          .getPublicUrl(`${projectId}/${indexCleanPath}`);

        const mapUrl = publicUrlData.publicUrl;

        // Update project with map URL
        const { error: updateError } = await supabase
          .from("projects")
          .update({ interactive_map_url: mapUrl })
          .eq("id", projectId);

        if (updateError) {
          throw new Error("Erro ao salvar URL do mapa no projeto.");
        }

        setUploadProgress(100);
        return mapUrl;
      } catch (err: any) {
        throw new Error(err.message || "Erro ao processar o arquivo ZIP.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      toast({
        title: "Mapa enviado com sucesso!",
        description: "O mapa interativo foi carregado e está pronto para uso.",
      });
      setIsUploading(false);
      setUploadProgress(0);
    },
    onError: (error: any) => {
      console.error("Erro no upload:", error);
      toast({
        title: "Erro ao enviar mapa",
        description: error.message || "Verifique se o arquivo ZIP está correto e tente novamente.",
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
    e.target.value = "";
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
              <TabsTrigger value="embed">
                <Code className="h-4 w-4 mr-2" />
                Embed / Plugin
              </TabsTrigger>
            </TabsList>

            <TabsContent value="map" className="space-y-4">
              {!project?.interactive_map_url ? (
                <Card className="border-dashed border-2">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <FileArchive className="h-16 w-16 text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold mb-2">Adicionar Mapa Interativo</h3>
                    <p className="text-muted-foreground text-center mb-6 max-w-md">
                      Envie o arquivo ZIP gerado pelo QGIS (qgis2web) contendo o mapa interativo.
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
                          Enviar ZIP do QGIS
                        </Button>
                      </>
                    )}

                    <div className="mt-8 max-w-md">
                      <div className="text-left bg-muted/50 p-4 rounded-lg">
                        <h4 className="font-semibold mb-2">Como exportar do QGIS:</h4>
                        <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                          <li>Instale o plugin <strong>qgis2web</strong> no QGIS</li>
                          <li>Vá em <strong>Web → qgis2web → Create web map</strong></li>
                          <li>Escolha <strong>Leaflet</strong> como formato de saída</li>
                          <li>Exporte para uma pasta local</li>
                          <li>Compacte a pasta inteira em um arquivo <strong>.zip</strong></li>
                          <li>Envie o arquivo ZIP aqui</li>
                        </ol>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <Badge variant="secondary">
                      <Map className="h-3 w-3 mr-1" />
                      Mapa carregado
                    </Badge>
                    <div className="flex flex-wrap gap-2">
                      <input
                        ref={replaceInputRef}
                        type="file"
                        accept=".zip"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => replaceInputRef.current?.click()}
                        disabled={isUploading}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Atualizar Mapa (ZIP)
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

            <TabsContent value="embed" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Code className="h-5 w-5" />
                    Embed / Plugin para Sites Externos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <p className="text-muted-foreground">
                    Use os códigos abaixo para incorporar o mapa interativo em sites externos 
                    (ex: portais de transparência, sites da prefeitura, etc.)
                  </p>

                  {!project?.interactive_map_url ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Map className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Envie um mapa primeiro para obter o código de embed.</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label className="font-semibold">URL Direta do Mapa</Label>
                        <p className="text-sm text-muted-foreground">
                          Use esta URL para acessar o mapa diretamente ou compartilhar.
                        </p>
                        <div className="flex gap-2">
                          <Input
                            readOnly
                            value={`${window.location.origin}/embed/map/${projectId}`}
                            className="font-mono text-sm"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/embed/map/${projectId}`);
                              toast({ title: "URL copiada!" });
                            }}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            asChild
                          >
                            <a href={`/embed/map/${projectId}`} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="font-semibold">Código iframe (Recomendado)</Label>
                        <p className="text-sm text-muted-foreground">
                          Cole este código no HTML do site onde deseja exibir o mapa.
                        </p>
                        <div className="relative">
                          <Textarea
                            readOnly
                            rows={4}
                            className="font-mono text-sm resize-none"
                            value={`<iframe 
  src="${window.location.origin}/embed/map/${projectId}"
  width="100%"
  height="600"
  style="border:none;"
  title="Mapa Interativo - ${project?.name || 'Projeto'}"
  allow="geolocation"
></iframe>`}
                          />
                          <Button
                            variant="secondary"
                            size="sm"
                            className="absolute top-2 right-2"
                            onClick={() => {
                              navigator.clipboard.writeText(`<iframe 
  src="${window.location.origin}/embed/map/${projectId}"
  width="100%"
  height="600"
  style="border:none;"
  title="Mapa Interativo - ${project?.name || 'Projeto'}"
  allow="geolocation"
></iframe>`);
                              toast({ title: "Código copiado!" });
                            }}
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            Copiar
                          </Button>
                        </div>
                      </div>

                      <div className="bg-muted/50 p-4 rounded-lg">
                        <h4 className="font-semibold mb-2">Dicas de Uso:</h4>
                        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                          <li>O mapa será exibido com todas as camadas e interatividade</li>
                          <li>Funciona em qualquer site que aceite HTML/JavaScript</li>
                          <li>Responsivo - se adapta ao tamanho do container</li>
                          <li>Atualizações no mapa refletem automaticamente no embed</li>
                        </ul>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

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
