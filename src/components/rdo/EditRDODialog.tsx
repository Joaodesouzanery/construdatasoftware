import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Save, Loader2, Cloud, Thermometer, Droplets, Wind, MapPin } from "lucide-react";
import { toast } from "sonner";

interface EditRDODialogProps {
  rdo: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface ExecutedService {
  id?: string;
  service_id: string;
  quantity: number;
  unit: string;
  service_name?: string;
  isNew?: boolean;
  toDelete?: boolean;
}

export const EditRDODialog = ({ rdo, open, onOpenChange, onSuccess }: EditRDODialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Campos básicos
  const [reportDate, setReportDate] = useState("");
  const [generalObservations, setGeneralObservations] = useState("");
  const [terrainCondition, setTerrainCondition] = useState("");
  const [visits, setVisits] = useState("");
  const [occurrencesSummary, setOccurrencesSummary] = useState("");
  
  // Campos de localização
  const [constructionSiteId, setConstructionSiteId] = useState("");
  const [serviceFrontId, setServiceFrontId] = useState("");
  const [gpsLocation, setGpsLocation] = useState("");
  
  // Campos meteorológicos
  const [temperature, setTemperature] = useState<number | null>(null);
  const [humidity, setHumidity] = useState<number | null>(null);
  const [windSpeed, setWindSpeed] = useState<number | null>(null);
  const [weatherDescription, setWeatherDescription] = useState("");
  const [willRain, setWillRain] = useState(false);
  
  // Listas e serviços
  const [executedServices, setExecutedServices] = useState<ExecutedService[]>([]);
  const [availableServices, setAvailableServices] = useState<any[]>([]);
  const [constructionSites, setConstructionSites] = useState<any[]>([]);
  const [serviceFronts, setServiceFronts] = useState<any[]>([]);

  useEffect(() => {
    if (open && rdo) {
      loadRDOData();
      loadAvailableServices();
      loadConstructionSites();
      loadServiceFronts();
    }
  }, [open, rdo]);

  const loadAvailableServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services_catalog')
        .select('id, name, unit')
        .order('name');

      if (error) throw error;
      setAvailableServices(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar serviços:", error);
    }
  };

  const loadConstructionSites = async () => {
    try {
      const { data, error } = await supabase
        .from('construction_sites')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setConstructionSites(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar canteiros:", error);
    }
  };

  const loadServiceFronts = async () => {
    try {
      const { data, error } = await supabase
        .from('service_fronts')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setServiceFronts(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar frentes de serviço:", error);
    }
  };

  const loadRDOData = async () => {
    setIsLoading(true);
    try {
      const { data: rdoData, error } = await supabase
        .from('daily_reports')
        .select(`
          *,
          executed_services(
            id,
            service_id,
            quantity,
            unit,
            services_catalog(name)
          )
        `)
        .eq('id', rdo.id)
        .single();

      if (error) throw error;

      // Campos básicos
      setReportDate(rdoData.report_date);
      setGeneralObservations(rdoData.general_observations || "");
      setTerrainCondition(rdoData.terrain_condition || "");
      setVisits(rdoData.visits || "");
      setOccurrencesSummary(rdoData.occurrences_summary || "");
      
      // Campos de localização
      setConstructionSiteId(rdoData.construction_site_id || "");
      setServiceFrontId(rdoData.service_front_id || "");
      setGpsLocation(rdoData.gps_location || "");
      
      // Campos meteorológicos
      setTemperature(rdoData.temperature);
      setHumidity(rdoData.humidity);
      setWindSpeed(rdoData.wind_speed);
      setWeatherDescription(rdoData.weather_description || "");
      setWillRain(rdoData.will_rain || false);
      
      setExecutedServices(
        rdoData.executed_services?.map((es: any) => ({
          id: es.id,
          service_id: es.service_id,
          quantity: es.quantity,
          unit: es.unit,
          service_name: es.services_catalog?.name,
          isNew: false,
          toDelete: false
        })) || []
      );
    } catch (error: any) {
      toast.error("Erro ao carregar dados do RDO: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddService = () => {
    setExecutedServices([
      ...executedServices,
      {
        service_id: "",
        quantity: 0,
        unit: "",
        isNew: true,
        toDelete: false
      }
    ]);
  };

  const handleRemoveService = (index: number) => {
    const service = executedServices[index];
    if (service.isNew) {
      // Se é novo, apenas remove
      setExecutedServices(executedServices.filter((_, i) => i !== index));
    } else {
      // Se existe no banco, marca para deletar
      setExecutedServices(
        executedServices.map((s, i) => 
          i === index ? { ...s, toDelete: true } : s
        )
      );
    }
  };

  const handleServiceChange = (index: number, field: keyof ExecutedService, value: any) => {
    setExecutedServices(
      executedServices.map((s, i) => {
        if (i === index) {
          const updated = { ...s, [field]: value };
          // Se mudou o serviço, atualizar a unidade
          if (field === 'service_id') {
            const selectedService = availableServices.find(svc => svc.id === value);
            if (selectedService) {
              updated.unit = selectedService.unit || "";
              updated.service_name = selectedService.name;
            }
          }
          return updated;
        }
        return s;
      })
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Atualizar o daily_report com todos os campos
      const { error: rdoError } = await supabase
        .from('daily_reports')
        .update({
          report_date: reportDate,
          general_observations: generalObservations || null,
          terrain_condition: terrainCondition || null,
          visits: visits || null,
          occurrences_summary: occurrencesSummary || null,
          construction_site_id: constructionSiteId || undefined,
          service_front_id: serviceFrontId || undefined,
          gps_location: gpsLocation || null,
          temperature: temperature,
          humidity: humidity,
          wind_speed: windSpeed,
          weather_description: weatherDescription || null,
          will_rain: willRain,
          updated_at: new Date().toISOString()
        })
        .eq('id', rdo.id);

      if (rdoError) throw rdoError;

      // Processar serviços
      for (const service of executedServices) {
        if (service.toDelete && service.id) {
          // Deletar serviço existente
          const { error } = await supabase
            .from('executed_services')
            .delete()
            .eq('id', service.id);
          if (error) throw error;
        } else if (service.isNew && !service.toDelete && service.service_id) {
          // Criar novo serviço
          const { error } = await supabase
            .from('executed_services')
            .insert({
              daily_report_id: rdo.id,
              service_id: service.service_id,
              quantity: service.quantity,
              unit: service.unit,
              created_by_user_id: (await supabase.auth.getUser()).data.user?.id
            });
          if (error) throw error;
        } else if (!service.isNew && !service.toDelete && service.id) {
          // Atualizar serviço existente
          const { error } = await supabase
            .from('executed_services')
            .update({
              service_id: service.service_id,
              quantity: service.quantity,
              unit: service.unit
            })
            .eq('id', service.id);
          if (error) throw error;
        }
      }

      toast.success("RDO atualizado com sucesso!");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Erro ao salvar RDO: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const visibleServices = executedServices.filter(s => !s.toDelete);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar RDO</DialogTitle>
          <DialogDescription>
            Altere os dados do Relatório Diário de Obra
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Dados Básicos */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Informações Gerais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="report_date">Data do Relatório</Label>
                    <Input
                      id="report_date"
                      type="date"
                      value={reportDate}
                      onChange={(e) => setReportDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="terrain_condition">Condição do Terreno</Label>
                    <Select 
                      value={terrainCondition || "none"} 
                      onValueChange={(v) => setTerrainCondition(v === "none" ? "" : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Não informado</SelectItem>
                        <SelectItem value="seco">Seco</SelectItem>
                        <SelectItem value="umido">Úmido</SelectItem>
                        <SelectItem value="molhado">Molhado</SelectItem>
                        <SelectItem value="alagado">Alagado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="construction_site">Canteiro de Obra</Label>
                    <Select 
                      value={constructionSiteId || "none"} 
                      onValueChange={(v) => setConstructionSiteId(v === "none" ? "" : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o canteiro..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Não informado</SelectItem>
                        {constructionSites.map(site => (
                          <SelectItem key={site.id} value={site.id}>
                            {site.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="service_front">Frente de Serviço</Label>
                    <Select 
                      value={serviceFrontId || "none"} 
                      onValueChange={(v) => setServiceFrontId(v === "none" ? "" : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a frente..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Não informado</SelectItem>
                        {serviceFronts.map(front => (
                          <SelectItem key={front.id} value={front.id}>
                            {front.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="visits">Visitas</Label>
                  <Input
                    id="visits"
                    value={visits}
                    onChange={(e) => setVisits(e.target.value)}
                    placeholder="Ex: Engenheiro João, Fiscal Maria"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gps_location" className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Localização GPS
                  </Label>
                  <Input
                    id="gps_location"
                    value={gpsLocation}
                    onChange={(e) => setGpsLocation(e.target.value)}
                    placeholder="Ex: -23.5505, -46.6333"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="observations">Observações Gerais</Label>
                  <Textarea
                    id="observations"
                    value={generalObservations}
                    onChange={(e) => setGeneralObservations(e.target.value)}
                    placeholder="Observações sobre o dia de trabalho..."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="occurrences">Resumo de Ocorrências</Label>
                  <Textarea
                    id="occurrences"
                    value={occurrencesSummary}
                    onChange={(e) => setOccurrencesSummary(e.target.value)}
                    placeholder="Ocorrências registradas no dia..."
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Dados Meteorológicos */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Cloud className="h-4 w-4" />
                  Condições Meteorológicas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="temperature" className="flex items-center gap-2">
                      <Thermometer className="h-4 w-4" />
                      Temperatura (°C)
                    </Label>
                    <Input
                      id="temperature"
                      type="number"
                      step="0.1"
                      value={temperature ?? ""}
                      onChange={(e) => setTemperature(e.target.value ? parseFloat(e.target.value) : null)}
                      placeholder="25.5"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="humidity" className="flex items-center gap-2">
                      <Droplets className="h-4 w-4" />
                      Umidade (%)
                    </Label>
                    <Input
                      id="humidity"
                      type="number"
                      min="0"
                      max="100"
                      value={humidity ?? ""}
                      onChange={(e) => setHumidity(e.target.value ? parseInt(e.target.value) : null)}
                      placeholder="65"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wind_speed" className="flex items-center gap-2">
                      <Wind className="h-4 w-4" />
                      Vento (km/h)
                    </Label>
                    <Input
                      id="wind_speed"
                      type="number"
                      step="0.1"
                      value={windSpeed ?? ""}
                      onChange={(e) => setWindSpeed(e.target.value ? parseFloat(e.target.value) : null)}
                      placeholder="12.5"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="weather_description">Descrição do Tempo</Label>
                    <Select 
                      value={weatherDescription || "none"} 
                      onValueChange={(v) => setWeatherDescription(v === "none" ? "" : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Não informado</SelectItem>
                        <SelectItem value="ensolarado">Ensolarado</SelectItem>
                        <SelectItem value="parcialmente_nublado">Parcialmente Nublado</SelectItem>
                        <SelectItem value="nublado">Nublado</SelectItem>
                        <SelectItem value="chuvoso">Chuvoso</SelectItem>
                        <SelectItem value="tempestade">Tempestade</SelectItem>
                        <SelectItem value="garoa">Garoa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="will_rain">Previsão de Chuva</Label>
                    <div className="flex items-center gap-3 h-10">
                      <Switch
                        id="will_rain"
                        checked={willRain}
                        onCheckedChange={setWillRain}
                      />
                      <span className="text-sm text-muted-foreground">
                        {willRain ? "Sim, há previsão" : "Não há previsão"}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Serviços Executados */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Serviços Executados</CardTitle>
                <Button size="sm" onClick={handleAddService}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {visibleServices.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum serviço registrado. Clique em "Adicionar" para incluir.
                  </p>
                ) : (
                  visibleServices.map((service, index) => {
                    const actualIndex = executedServices.findIndex(s => s === service);
                    return (
                      <div key={actualIndex} className="flex gap-2 items-end p-3 bg-muted/50 rounded-lg">
                        <div className="flex-1 space-y-1">
                          <Label className="text-xs">Serviço</Label>
                          <Select
                            value={service.service_id || "none"}
                            onValueChange={(v) => handleServiceChange(actualIndex, 'service_id', v === "none" ? "" : v)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o serviço" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Selecione...</SelectItem>
                              {availableServices.map(svc => (
                                <SelectItem key={svc.id} value={svc.id}>
                                  {svc.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-24 space-y-1">
                          <Label className="text-xs">Quantidade</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={service.quantity}
                            onChange={(e) => handleServiceChange(actualIndex, 'quantity', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div className="w-20 space-y-1">
                          <Label className="text-xs">Unidade</Label>
                          <Input
                            value={service.unit}
                            onChange={(e) => handleServiceChange(actualIndex, 'unit', e.target.value)}
                            placeholder="m², un"
                          />
                        </div>
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => handleRemoveService(actualIndex)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            {/* Botões */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar Alterações
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
