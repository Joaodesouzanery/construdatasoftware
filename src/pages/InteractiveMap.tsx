import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

interface MapMarker {
  id: string;
  type: 'point' | 'polygon' | 'area';
  name: string;
  description?: string;
  progress?: number;
  teamId?: string;
  serviceFrontId?: string;
  coordinates?: string;
  color?: string;
}

interface MapLayer {
  id: string;
  name: string;
  visible: boolean;
  type: 'base' | 'overlay';
  content?: string;
}

export default function InteractiveMap() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [mapContent, setMapContent] = useState<string>("");
  const [mapFileName, setMapFileName] = useState<string>("");
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [layers, setLayers] = useState<MapLayer[]>([]);
  const [showAddMarkerDialog, setShowAddMarkerDialog] = useState(false);
  const [showAddLayerDialog, setShowAddLayerDialog] = useState(false);
  const [editingMarker, setEditingMarker] = useState<MapMarker | null>(null);
  const [newMarker, setNewMarker] = useState<Partial<MapMarker>>({
    type: 'point',
    progress: 0,
    color: '#3b82f6',
  });
  const [activeTab, setActiveTab] = useState("map");

  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const { data: serviceFronts } = useQuery({
    queryKey: ["service-fronts-map"],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_fronts")
        .select("*, construction_sites(name)");
      return data || [];
    },
    enabled: !!session,
  });

  const { data: employees } = useQuery({
    queryKey: ["employees-map"],
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("id, name")
        .eq("status", "active");
      return data || [];
    },
    enabled: !!session,
  });

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const validExtensions = ['.html', '.htm', '.geojson', '.json', '.kml', '.kmz'];
    const isValid = validExtensions.some(ext => fileName.endsWith(ext));

    if (!isValid) {
      toast({
        title: "Formato inválido",
        description: "Por favor, envie um arquivo HTML, GeoJSON, KML ou KMZ.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (fileName.endsWith('.html') || fileName.endsWith('.htm')) {
        const content = await file.text();
        setMapContent(content);
        setMapFileName(file.name);
        
        toast({
          title: "Mapa carregado!",
          description: `Arquivo ${file.name} importado com sucesso.`,
        });
      } else if (fileName.endsWith('.geojson') || fileName.endsWith('.json')) {
        const content = await file.text();
        const geoJson = JSON.parse(content);
        
        // Converter GeoJSON para HTML com Leaflet
        const htmlContent = generateLeafletMap(geoJson);
        setMapContent(htmlContent);
        setMapFileName(file.name);
        
        toast({
          title: "GeoJSON carregado!",
          description: `Arquivo ${file.name} convertido e importado.`,
        });
      } else if (fileName.endsWith('.kml') || fileName.endsWith('.kmz')) {
        // Para KML/KMZ, precisaria de um parser mais complexo
        toast({
          title: "Em desenvolvimento",
          description: "Suporte a KML/KMZ será implementado em breve.",
        });
      }
    } catch (error) {
      console.error("Error loading file:", error);
      toast({
        title: "Erro ao carregar arquivo",
        description: "Não foi possível processar o arquivo enviado.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const generateLeafletMap = (geoJson: any): string => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; }
    .custom-popup { font-family: system-ui, sans-serif; }
    .progress-badge { 
      display: inline-block; 
      padding: 2px 8px; 
      border-radius: 4px; 
      font-size: 12px; 
      font-weight: bold;
      color: white;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const geoJsonData = ${JSON.stringify(geoJson)};
    
    // Calcular centro do mapa
    let center = [-23.5505, -46.6333]; // São Paulo default
    let zoom = 10;
    
    if (geoJsonData.features && geoJsonData.features.length > 0) {
      const bounds = L.geoJSON(geoJsonData).getBounds();
      if (bounds.isValid()) {
        center = bounds.getCenter();
      }
    }
    
    const map = L.map('map').setView(center, zoom);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    const geoJsonLayer = L.geoJSON(geoJsonData, {
      style: function(feature) {
        return {
          color: feature.properties?.color || '#3388ff',
          weight: 2,
          fillOpacity: 0.3
        };
      },
      onEachFeature: function(feature, layer) {
        if (feature.properties) {
          let popupContent = '<div class="custom-popup">';
          if (feature.properties.name) {
            popupContent += '<strong>' + feature.properties.name + '</strong><br>';
          }
          if (feature.properties.description) {
            popupContent += feature.properties.description + '<br>';
          }
          if (feature.properties.progress !== undefined) {
            const color = feature.properties.progress >= 80 ? '#22c55e' : 
                         feature.properties.progress >= 50 ? '#eab308' : '#ef4444';
            popupContent += '<span class="progress-badge" style="background:' + color + '">' + 
                          feature.properties.progress + '%</span>';
          }
          popupContent += '</div>';
          layer.bindPopup(popupContent);
        }
      }
    }).addTo(map);
    
    if (geoJsonLayer.getBounds().isValid()) {
      map.fitBounds(geoJsonLayer.getBounds());
    }
  </script>
</body>
</html>`;
  };

  const handleAddMarker = () => {
    if (!newMarker.name) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, insira um nome para o marcador.",
        variant: "destructive",
      });
      return;
    }

    const marker: MapMarker = {
      id: crypto.randomUUID(),
      type: newMarker.type || 'point',
      name: newMarker.name,
      description: newMarker.description,
      progress: newMarker.progress || 0,
      teamId: newMarker.teamId,
      serviceFrontId: newMarker.serviceFrontId,
      color: newMarker.color || '#3b82f6',
    };

    setMarkers(prev => [...prev, marker]);
    setShowAddMarkerDialog(false);
    setNewMarker({ type: 'point', progress: 0, color: '#3b82f6' });

    toast({
      title: "Marcador adicionado",
      description: `Marcador "${marker.name}" criado com sucesso.`,
    });
  };

  const handleUpdateMarkerProgress = (markerId: string, progress: number) => {
    setMarkers(prev => prev.map(m => 
      m.id === markerId ? { ...m, progress } : m
    ));
  };

  const handleDeleteMarker = (markerId: string) => {
    setMarkers(prev => prev.filter(m => m.id !== markerId));
    toast({
      title: "Marcador removido",
      description: "Marcador excluído com sucesso.",
    });
  };

  const toggleLayerVisibility = (layerId: string) => {
    setLayers(prev => prev.map(l => 
      l.id === layerId ? { ...l, visible: !l.visible } : l
    ));
  };

  const getMarkerIcon = (type: string) => {
    switch (type) {
      case 'polygon': return <Square className="h-4 w-4" />;
      case 'area': return <Hexagon className="h-4 w-4" />;
      default: return <MapPin className="h-4 w-4" />;
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return "bg-green-500";
    if (progress >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Map className="h-8 w-8" />
              Mapa Interativo
            </h1>
            <p className="text-muted-foreground">
              Importe mapas, adicione marcações e acompanhe o avanço das frentes de serviço
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="map">
                <Map className="h-4 w-4 mr-2" />
                Mapa
              </TabsTrigger>
              <TabsTrigger value="markers">
                <MapPin className="h-4 w-4 mr-2" />
                Marcadores ({markers.length})
              </TabsTrigger>
              <TabsTrigger value="layers">
                <Layers className="h-4 w-4 mr-2" />
                Camadas ({layers.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="map" className="space-y-4">
              {/* Upload Area */}
              {!mapContent && (
                <Card className="border-dashed border-2">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Upload className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Importar Mapa</h3>
                    <p className="text-sm text-muted-foreground text-center mb-4">
                      Envie um arquivo HTML, GeoJSON, KML ou KMZ criado em QGIS, ArcGIS, drones, etc.
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".html,.htm,.geojson,.json,.kml,.kmz"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <Button onClick={() => fileInputRef.current?.click()}>
                      <FileCode className="h-4 w-4 mr-2" />
                      Selecionar Arquivo
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Map Display */}
              {mapContent && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        <FileCode className="h-3 w-3 mr-1" />
                        {mapFileName}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="h-4 w-4 mr-2" />
                        Trocar Mapa
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setShowAddMarkerDialog(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar Marcação
                      </Button>
                    </div>
                  </div>

                  <Card className="overflow-hidden">
                    <iframe
                      ref={iframeRef}
                      srcDoc={mapContent}
                      className="w-full h-[600px] border-0"
                      title="Mapa Interativo"
                      sandbox="allow-scripts allow-same-origin"
                    />
                  </Card>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".html,.htm,.geojson,.json,.kml,.kmz"
                onChange={handleFileUpload}
                className="hidden"
              />
            </TabsContent>

            <TabsContent value="markers" className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Marcações e Avanços</h2>
                <Button onClick={() => setShowAddMarkerDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Marcação
                </Button>
              </div>

              {markers.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma marcação adicionada ainda.</p>
                    <p className="text-sm">Adicione marcações para acompanhar o avanço de setores.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {markers.map(marker => (
                    <Card key={marker.id}>
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center justify-between text-base">
                          <div className="flex items-center gap-2">
                            <div 
                              className="p-1.5 rounded" 
                              style={{ backgroundColor: marker.color + '20', color: marker.color }}
                            >
                              {getMarkerIcon(marker.type)}
                            </div>
                            {marker.name}
                          </div>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => {
                                setEditingMarker(marker);
                                setNewMarker(marker);
                                setShowAddMarkerDialog(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleDeleteMarker(marker.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {marker.description && (
                          <p className="text-sm text-muted-foreground">{marker.description}</p>
                        )}
                        
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span>Avanço</span>
                            <span className="font-medium">{marker.progress}%</span>
                          </div>
                          <Progress value={marker.progress} className={getProgressColor(marker.progress || 0)} />
                        </div>

                        <div className="flex gap-2 mt-2">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={marker.progress}
                            onChange={(e) => handleUpdateMarkerProgress(marker.id, Number(e.target.value))}
                            className="w-20"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUpdateMarkerProgress(marker.id, Math.min(100, (marker.progress || 0) + 10))}
                          >
                            +10%
                          </Button>
                        </div>

                        {marker.teamId && (
                          <Badge variant="outline" className="mt-2">
                            <Users className="h-3 w-3 mr-1" />
                            {employees?.find(e => e.id === marker.teamId)?.name || 'Equipe'}
                          </Badge>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="layers" className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Camadas do Mapa</h2>
                <Button onClick={() => setShowAddLayerDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Camada
                </Button>
              </div>

              {layers.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <Layers className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma camada adicional.</p>
                    <p className="text-sm">Importe camadas para sobrepor no mapa base.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {layers.map(layer => (
                    <Card key={layer.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleLayerVisibility(layer.id)}
                          >
                            {layer.visible ? (
                              <Eye className="h-4 w-4" />
                            ) : (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                          <div>
                            <p className="font-medium">{layer.name}</p>
                            <p className="text-sm text-muted-foreground">{layer.type}</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Add Marker Dialog */}
          <Dialog open={showAddMarkerDialog} onOpenChange={setShowAddMarkerDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingMarker ? 'Editar Marcação' : 'Nova Marcação'}
                </DialogTitle>
                <DialogDescription>
                  Adicione uma marcação para acompanhar o avanço de um setor ou área.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input
                    value={newMarker.name || ''}
                    onChange={(e) => setNewMarker(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Setor A, Bloco 1, etc."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tipo de Marcação</Label>
                  <Select
                    value={newMarker.type}
                    onValueChange={(value: 'point' | 'polygon' | 'area') => 
                      setNewMarker(prev => ({ ...prev, type: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="point">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          Ponto
                        </div>
                      </SelectItem>
                      <SelectItem value="polygon">
                        <div className="flex items-center gap-2">
                          <Square className="h-4 w-4" />
                          Polígono
                        </div>
                      </SelectItem>
                      <SelectItem value="area">
                        <div className="flex items-center gap-2">
                          <Hexagon className="h-4 w-4" />
                          Área
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea
                    value={newMarker.description || ''}
                    onChange={(e) => setNewMarker(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Descrição opcional..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Avanço (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={newMarker.progress || 0}
                      onChange={(e) => setNewMarker(prev => ({ ...prev, progress: Number(e.target.value) }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Cor</Label>
                    <Input
                      type="color"
                      value={newMarker.color || '#3b82f6'}
                      onChange={(e) => setNewMarker(prev => ({ ...prev, color: e.target.value }))}
                      className="h-10 p-1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Frente de Serviço</Label>
                  <Select
                    value={newMarker.serviceFrontId || ''}
                    onValueChange={(value) => setNewMarker(prev => ({ ...prev, serviceFrontId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {serviceFronts?.map(sf => (
                        <SelectItem key={sf.id} value={sf.id}>
                          {sf.name} - {sf.construction_sites?.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Equipe Responsável</Label>
                  <Select
                    value={newMarker.teamId || ''}
                    onValueChange={(value) => setNewMarker(prev => ({ ...prev, teamId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {employees?.map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setShowAddMarkerDialog(false);
                  setEditingMarker(null);
                  setNewMarker({ type: 'point', progress: 0, color: '#3b82f6' });
                }}>
                  Cancelar
                </Button>
                <Button onClick={handleAddMarker}>
                  <Save className="h-4 w-4 mr-2" />
                  {editingMarker ? 'Salvar' : 'Adicionar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </SidebarProvider>
  );
}
