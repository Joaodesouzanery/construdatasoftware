import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Plus, Trash2, FileText, BarChart3, Eye, MapPin, Image, Cloud, Download } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AddServiceFrontDialog } from "@/components/rdo/AddServiceFrontDialog";
import { AddConstructionSiteDialog } from "@/components/rdo/AddConstructionSiteDialog";
import { AddServiceDialog } from "@/components/rdo/AddServiceDialog";
import { RDOHistoryView } from "@/components/rdo/RDOHistoryView";

interface ExecutedService {
  service_id: string;
  quantity: string;
  unit: string;
  equipment_used: string;
  employee_id?: string;
  justification?: string;
}

interface CustomQuestion {
  id: string;
  question: string;
  answer: string;
  type: 'text' | 'select' | 'number';
  options?: string[];
}

const RDONew = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Data from database
  const [projects, setProjects] = useState<any[]>([]);
  const [serviceFronts, setServiceFronts] = useState<any[]>([]);
  const [constructionSites, setConstructionSites] = useState<any[]>([]);
  const [servicesCatalog, setServicesCatalog] = useState<any[]>([]);
  const [productionTargets, setProductionTargets] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  // Form state
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedServiceFronts, setSelectedServiceFronts] = useState<string[]>([]);
  const [selectedConstructionSites, setSelectedConstructionSites] = useState<string[]>([]);
  const [reportDate, setReportDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [executedServices, setExecutedServices] = useState<ExecutedService[]>([
    { service_id: "", quantity: "", unit: "", equipment_used: "" }
  ]);
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>([]);
  const [showNewQuestionDialog, setShowNewQuestionDialog] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState("");
  const [newQuestionType, setNewQuestionType] = useState<'text' | 'select' | 'number'>('text');
  
  // Novos campos
  const [terrainCondition, setTerrainCondition] = useState("");
  const [location, setLocation] = useState("");
  const [generalObservations, setGeneralObservations] = useState("");
  const [validationPhotos, setValidationPhotos] = useState<File[]>([]);
  const [lastCreatedRDOId, setLastCreatedRDOId] = useState<string | null>(null);
  const [weatherData, setWeatherData] = useState<any>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);

  // Dialog states
  const [showServiceFrontDialog, setShowServiceFrontDialog] = useState(false);
  const [showConstructionSiteDialog, setShowConstructionSiteDialog] = useState(false);
  const [showServiceDialog, setShowServiceDialog] = useState(false);

  useEffect(() => {
    checkAuth();
    loadProjects();
    loadServicesCatalog();
    loadEmployees();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      loadServiceFronts(selectedProject);
      loadConstructionSites(selectedProject);
    }
  }, [selectedProject]);

  useEffect(() => {
    if (selectedServiceFronts.length > 0) {
      selectedServiceFronts.forEach(frontId => loadProductionTargets(frontId));
    }
  }, [selectedServiceFronts]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth');
      return;
    }
    setUser(session.user);
  };

  const loadProjects = async () => {
    const { data } = await supabase
      .from('projects')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    if (data) setProjects(data);
  };

  const loadServiceFronts = async (projectId: string) => {
    const { data } = await supabase
      .from('service_fronts')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (data) setServiceFronts(data);
  };

  const loadConstructionSites = async (projectId: string) => {
    const { data } = await supabase
      .from('construction_sites')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (data) setConstructionSites(data);
  };

  const loadServicesCatalog = async () => {
    const { data } = await supabase
      .from('services_catalog')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setServicesCatalog(data);
  };

  const loadEmployees = async () => {
    const { data } = await supabase
      .from('employees')
      .select('*')
      .eq('status', 'active')
      .order('name', { ascending: true });
    if (data) setEmployees(data);
  };

  const loadProductionTargets = async (serviceFrontId: string) => {
    const { data } = await supabase
      .from('production_targets')
      .select('*')
      .eq('service_front_id', serviceFrontId)
      .order('created_at', { ascending: false });
    if (data) setProductionTargets(data);
  };

  const addExecutedService = () => {
    setExecutedServices([...executedServices, { service_id: "", quantity: "", unit: "", equipment_used: "", employee_id: "" }]);
  };

  const removeExecutedService = (index: number) => {
    const newServices = executedServices.filter((_, i) => i !== index);
    setExecutedServices(newServices);
  };

  const updateExecutedService = (index: number, field: keyof ExecutedService, value: string) => {
    const newServices = [...executedServices];
    newServices[index] = { ...newServices[index], [field]: value };
    
    // Update unit when service is selected
    if (field === 'service_id' && value) {
      const service = servicesCatalog.find(s => s.id === value);
      if (service) {
        newServices[index].unit = service.unit;
      }
    }

    setExecutedServices(newServices);
  };

  const checkBelowTarget = (serviceId: string, quantity: number): boolean => {
    const target = productionTargets.find(
      t => t.service_id === serviceId && new Date(t.target_date).toDateString() === new Date(reportDate).toDateString()
    );
    
    if (target && quantity < target.target_quantity) {
      return true;
    }
    return false;
  };

  const addCustomQuestion = () => {
    if (!newQuestionText.trim()) {
      toast.error("Digite uma pergunta");
      return;
    }
    
    const newQuestion: CustomQuestion = {
      id: crypto.randomUUID(),
      question: newQuestionText,
      answer: "",
      type: newQuestionType,
      options: newQuestionType === 'select' ? [] : undefined
    };
    
    setCustomQuestions([...customQuestions, newQuestion]);
    setNewQuestionText("");
    setNewQuestionType('text');
    setShowNewQuestionDialog(false);
    toast.success("Pergunta adicionada");
  };

  const updateCustomQuestion = (id: string, answer: string) => {
    setCustomQuestions(customQuestions.map(q => 
      q.id === id ? { ...q, answer } : q
    ));
  };

  const removeCustomQuestion = (id: string) => {
    setCustomQuestions(customQuestions.filter(q => q.id !== id));
  };

  const handleGetGPS = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude.toFixed(6);
          const lng = position.coords.longitude.toFixed(6);
          setLocation(`${lat}, ${lng}`);
          toast.success("Localização obtida com sucesso!");
          
          // Buscar dados climáticos
          setIsLoadingWeather(true);
          try {
            const { data, error } = await supabase.functions.invoke('weather-data', {
              body: { 
                latitude: position.coords.latitude, 
                longitude: position.coords.longitude 
              }
            });
            
            if (error) throw error;
            if (data) {
              setWeatherData(data);
              toast.success("Dados climáticos obtidos!");
            }
          } catch (error: any) {
            console.error('Erro ao buscar clima:', error);
            toast.error("Não foi possível obter dados climáticos");
          } finally {
            setIsLoadingWeather(false);
          }
        },
        (error) => {
          toast.error("Erro ao obter localização: " + error.message);
        }
      );
    } else {
      toast.error("Geolocalização não disponível neste navegador");
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setValidationPhotos([...validationPhotos, ...newFiles]);
      toast.success(`${newFiles.length} foto(s) adicionada(s)`);
    }
  };

  const removePhoto = (index: number) => {
    setValidationPhotos(validationPhotos.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedProject || selectedServiceFronts.length === 0 || selectedConstructionSites.length === 0) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    // Validate executed services
    const validServices = executedServices.filter(s => s.service_id && s.quantity);
    if (validServices.length === 0) {
      toast.error("Adicione pelo menos um serviço executado");
      return;
    }

    // Check for below target services that need justification
    const servicesNeedingJustification = validServices.filter(s => {
      const qty = parseFloat(s.quantity);
      return checkBelowTarget(s.service_id, qty) && !s.justification;
    });

    if (servicesNeedingJustification.length > 0) {
      toast.error("Preencha as justificativas para serviços abaixo da meta");
      return;
    }

    setIsLoading(true);
    
    try {
      // Create multiple daily reports (one for each combination of service front and construction site)
      const reportIds: string[] = [];
      
      for (const serviceFrontId of selectedServiceFronts) {
        for (const constructionSiteId of selectedConstructionSites) {
          const { data: dailyReport, error: reportError } = await supabase
            .from('daily_reports')
            .insert([{
              report_date: reportDate,
              project_id: selectedProject,
              construction_site_id: constructionSiteId,
              service_front_id: serviceFrontId,
              executed_by_user_id: user.id,
              temperature: weatherData?.temperature || null,
              humidity: weatherData?.humidity || null,
              wind_speed: weatherData?.windSpeed || null,
              will_rain: weatherData?.willRain || null,
              weather_description: weatherData?.description || null,
              terrain_condition: terrainCondition || null,
              gps_location: location || null,
              general_observations: generalObservations || null
            }])
            .select()
            .single();

          if (reportError) throw reportError;
          reportIds.push(dailyReport.id);
          
          // Upload validation photos for each report
          if (validationPhotos.length > 0) {
            for (const photo of validationPhotos) {
              const fileName = `${user.id}/${dailyReport.id}/${crypto.randomUUID()}_${photo.name}`;
              
              const { error: uploadError } = await supabase.storage
                .from('rdo-photos')
                .upload(fileName, photo);

              if (uploadError) {
                console.error('Error uploading photo:', uploadError);
                continue;
              }

              const { data: photoData } = supabase.storage
                .from('rdo-photos')
                .getPublicUrl(fileName);

              await supabase
                .from('rdo_validation_photos')
                .insert({
                  daily_report_id: dailyReport.id,
                  photo_url: photoData.publicUrl,
                  created_by_user_id: user.id
                });
            }
          }

          // Insert executed services for this report
          for (const service of validServices) {
            const { data: executedService, error: serviceError } = await supabase
              .from('executed_services')
              .insert([{
                daily_report_id: dailyReport.id,
                service_id: service.service_id,
                quantity: parseFloat(service.quantity),
                unit: service.unit,
                equipment_used: service.equipment_used ? { equipment: service.equipment_used } : null,
                employee_id: service.employee_id || null,
                created_by_user_id: user.id
              }])
              .select()
              .single();

            if (serviceError) throw serviceError;

            // Add justification if below target
            if (service.justification) {
              const { error: justError } = await supabase
                .from('justifications')
                .insert([{
                  daily_report_id: dailyReport.id,
                  executed_service_id: executedService.id,
                  reason: service.justification,
                  created_by_user_id: user.id
                }]);

              if (justError) throw justError;
            }
          }
        }
      }

      toast.success(`${reportIds.length} RDO(s) criado(s) com sucesso!`);
      setLastCreatedRDOId(reportIds[0]);

      // Reset form
      setSelectedServiceFronts([]);
      setSelectedConstructionSites([]);
      setReportDate(new Date().toISOString().split('T')[0]);
      setExecutedServices([{ service_id: "", quantity: "", unit: "", equipment_used: "", employee_id: "" }]);
      setTerrainCondition("");
      setLocation("");
      setGeneralObservations("");
      setValidationPhotos([]);
      setCustomQuestions([]);
      
    } catch (error: any) {
      toast.error("Erro ao criar RDO: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const exportRDOToPDF = async () => {
    if (!lastCreatedRDOId) {
      toast.error("Nenhum RDO para exportar");
      return;
    }

    try {
      // Buscar dados do RDO
      const { data: rdoData, error: rdoError } = await supabase
        .from('daily_reports')
        .select(`
          *,
          project:projects(name),
          service_front:service_fronts(name),
          construction_site:construction_sites(name, address)
        `)
        .eq('id', lastCreatedRDOId)
        .single();

      if (rdoError) throw rdoError;

      // Buscar serviços executados
      const { data: services, error: servicesError } = await supabase
        .from('executed_services')
        .select(`
          *,
          service:services_catalog(name)
        `)
        .eq('daily_report_id', lastCreatedRDOId);

      if (servicesError) throw servicesError;

      // Gerar PDF
      const jsPDF = (await import('jspdf')).default;
      const doc = new jsPDF();
      
      let yPos = 20;
      
      // Título
      doc.setFontSize(18);
      doc.text('Relatório Diário de Obra (RDO)', 20, yPos);
      yPos += 15;
      
      // Informações do projeto
      doc.setFontSize(12);
      doc.text(`Projeto: ${rdoData.project?.name || 'N/A'}`, 20, yPos);
      yPos += 8;
      doc.text(`Frente de Serviço: ${rdoData.service_front?.name || 'N/A'}`, 20, yPos);
      yPos += 8;
      doc.text(`Local: ${rdoData.construction_site?.name || 'N/A'}`, 20, yPos);
      yPos += 8;
      doc.text(`Data: ${new Date(rdoData.report_date).toLocaleDateString('pt-BR')}`, 20, yPos);
      yPos += 15;
      
      // Serviços executados
      doc.setFontSize(14);
      doc.text('Serviços Executados:', 20, yPos);
      yPos += 10;
      
      doc.setFontSize(11);
      services?.forEach((service: any, index: number) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        doc.text(`${index + 1}. ${service.service?.name || 'N/A'}`, 25, yPos);
        yPos += 6;
        doc.text(`   Quantidade: ${service.quantity} ${service.unit}`, 25, yPos);
        yPos += 6;
        if (service.equipment_used) {
          doc.text(`   Equipamentos: ${JSON.stringify(service.equipment_used)}`, 25, yPos);
          yPos += 6;
        }
        yPos += 4;
      });
      
      // Campos opcionais
      if (terrainCondition) {
        yPos += 5;
        doc.setFontSize(12);
        doc.text(`Condição do Terreno: ${terrainCondition}`, 20, yPos);
        yPos += 8;
      }
      
      if (location) {
        doc.text(`Localização: ${location}`, 20, yPos);
        yPos += 8;
      }
      
      if (generalObservations) {
        yPos += 5;
        doc.setFontSize(12);
        doc.text('Observações Gerais:', 20, yPos);
        yPos += 8;
        doc.setFontSize(11);
        const lines = doc.splitTextToSize(generalObservations, 170);
        lines.forEach((line: string) => {
          if (yPos > 270) {
            doc.addPage();
            yPos = 20;
          }
          doc.text(line, 20, yPos);
          yPos += 6;
        });
      }
      
      // Salvar PDF
      doc.save(`RDO_${rdoData.project?.name}_${rdoData.report_date}.pdf`);
      toast.success("PDF gerado com sucesso!");
      
    } catch (error: any) {
      toast.error("Erro ao gerar PDF: " + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/dashboard')}>
              <Building2 className="w-6 h-6 mr-2" />
              <span className="font-bold">ConstruData</span>
            </Button>
            <h1 className="text-xl font-semibold">Relatório Diário de Obra (RDO)</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          <div className="lg:col-span-2">
        <Tabs defaultValue="create">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="create">
              <FileText className="w-4 h-4 mr-2" />
              Criar RDO
            </TabsTrigger>
            <TabsTrigger value="history">
              <BarChart3 className="w-4 h-4 mr-2" />
              Histórico e Gráficos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create">
            <Card>
              <CardHeader>
                <CardTitle>Novo RDO</CardTitle>
                <CardDescription>Preencha as informações do relatório diário</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Quadros Selecionáveis Numerados */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Informações do RDO</h3>
                
                {/* Quadro 0: Projeto */}
                <Card className="border-2 border-primary/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Projeto *</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Select 
                      value={selectedProject} 
                      onValueChange={setSelectedProject}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o projeto" />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map(project => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>

                {/* Quadro 1: Frentes de Serviço */}
                <Card className="border-2 border-primary/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">1. Frentes de Serviço *</CardTitle>
                    <CardDescription className="text-xs">Selecione uma ou mais frentes</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="border rounded-md p-2 max-h-40 overflow-y-auto space-y-2">
                      {serviceFronts.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhuma frente disponível</p>
                      ) : (
                        serviceFronts.map(front => (
                          <label key={front.id} className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedServiceFronts.includes(front.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedServiceFronts([...selectedServiceFronts, front.id]);
                                } else {
                                  setSelectedServiceFronts(selectedServiceFronts.filter(id => id !== front.id));
                                }
                              }}
                              disabled={!selectedProject}
                              className="rounded"
                            />
                            <span className="text-sm">{front.name}</span>
                          </label>
                        ))
                      )}
                    </div>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowServiceFrontDialog(true)}
                      disabled={!selectedProject}
                      className="w-full"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Adicionar Nova Frente
                    </Button>
                  </CardContent>
                </Card>

                {/* Quadro 2: Locais da Obra */}
                <Card className="border-2 border-primary/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">2. Locais da Obra *</CardTitle>
                    <CardDescription className="text-xs">Selecione um ou mais locais</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="border rounded-md p-2 max-h-40 overflow-y-auto space-y-2">
                      {constructionSites.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhum local disponível</p>
                      ) : (
                        constructionSites.map(site => (
                          <label key={site.id} className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedConstructionSites.includes(site.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedConstructionSites([...selectedConstructionSites, site.id]);
                                } else {
                                  setSelectedConstructionSites(selectedConstructionSites.filter(id => id !== site.id));
                                }
                              }}
                              disabled={!selectedProject}
                              className="rounded"
                            />
                            <span className="text-sm">{site.name}</span>
                          </label>
                        ))
                      )}
                    </div>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowConstructionSiteDialog(true)}
                      disabled={!selectedProject}
                      className="w-full"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Adicionar Novo Local
                    </Button>
                  </CardContent>
                </Card>

                {/* Quadro 3: Serviços Executados */}
                <Card className="border-2 border-primary/20">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">3. Serviços Executados *</CardTitle>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={() => setShowServiceDialog(true)}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Adicionar Serviço ao Catálogo
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {executedServices.map((service, index) => (
                      <Card key={index} className="p-4 bg-muted/30">
                        <div className="space-y-4">
                          <div className="flex items-start justify-between">
                            <h4 className="font-medium">Serviço {index + 1}</h4>
                            {executedServices.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeExecutedService(index)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Serviço</Label>
                              <Select
                                value={service.service_id}
                                onValueChange={(value) => updateExecutedService(index, 'service_id', value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione o serviço" />
                                </SelectTrigger>
                                <SelectContent>
                                  {servicesCatalog.map(s => (
                                    <SelectItem key={s.id} value={s.id}>
                                      {s.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label>Quantidade</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={service.quantity}
                                onChange={(e) => updateExecutedService(index, 'quantity', e.target.value)}
                                placeholder="0.00"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Unidade</Label>
                              <Input
                                value={service.unit}
                                onChange={(e) => updateExecutedService(index, 'unit', e.target.value)}
                                placeholder="m², m³, un"
                                readOnly
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Equipamentos Utilizados (opcional)</Label>
                              <Input
                                value={service.equipment_used}
                                onChange={(e) => updateExecutedService(index, 'equipment_used', e.target.value)}
                                placeholder="Betoneira, Vibrador..."
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Funcionário Responsável (opcional)</Label>
                              <Select
                                value={service.employee_id}
                                onValueChange={(value) => updateExecutedService(index, 'employee_id', value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione o funcionário" />
                                </SelectTrigger>
                                <SelectContent>
                                  {employees.map(emp => (
                                    <SelectItem key={emp.id} value={emp.id}>
                                      {emp.name} {emp.role ? `- ${emp.role}` : ''}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {service.service_id && service.quantity && checkBelowTarget(service.service_id, parseFloat(service.quantity)) && (
                            <div className="space-y-2 border-t pt-4">
                              <Label className="text-destructive">Justificativa (Produção Abaixo da Meta) *</Label>
                              <Textarea
                                value={service.justification || ""}
                                onChange={(e) => updateExecutedService(index, 'justification', e.target.value)}
                                placeholder="Explique o motivo da produção estar abaixo da meta..."
                                rows={3}
                                className="border-destructive"
                              />
                            </div>
                          )}
                        </div>
                      </Card>
                    ))}

                    <Button
                      type="button"
                      variant="outline"
                      onClick={addExecutedService}
                      className="w-full"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar Outro Serviço
                    </Button>
                  </CardContent>
                </Card>

                {/* Perguntas Customizadas */}
                {customQuestions.map((question, index) => (
                  <Card key={question.id} className="border-2 border-primary/20">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{index + 4}. {question.question}</CardTitle>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCustomQuestion(question.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {question.type === 'text' && (
                        <Textarea
                          value={question.answer}
                          onChange={(e) => updateCustomQuestion(question.id, e.target.value)}
                          placeholder="Digite sua resposta..."
                          rows={3}
                        />
                      )}
                      {question.type === 'number' && (
                        <Input
                          type="number"
                          value={question.answer}
                          onChange={(e) => updateCustomQuestion(question.id, e.target.value)}
                          placeholder="Digite um número..."
                        />
                      )}
                    </CardContent>
                  </Card>
                ))}

                {/* Botão Nova Pergunta */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowNewQuestionDialog(true)}
                  className="w-full border-dashed border-2"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Pergunta
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="project">Obra *</Label>
                  <Select value={selectedProject} onValueChange={setSelectedProject}>
                    <SelectTrigger id="project">
                      <SelectValue placeholder="Selecione a obra" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map(project => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date">Data *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Condição do Terreno */}
              <div className="space-y-2">
                <Label htmlFor="terrainCondition">Condição do Terreno (opcional)</Label>
                <Select value={terrainCondition} onValueChange={setTerrainCondition}>
                  <SelectTrigger id="terrainCondition">
                    <SelectValue placeholder="Selecione a condição" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="seco">Seco</SelectItem>
                    <SelectItem value="umido">Úmido</SelectItem>
                    <SelectItem value="molhado">Molhado</SelectItem>
                    <SelectItem value="lamacento">Lamacento</SelectItem>
                    <SelectItem value="alagado">Alagado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Localização */}
              <div className="space-y-2">
                <Label htmlFor="location">Localização (opcional)</Label>
                <div className="flex gap-2">
                  <Input
                    id="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Latitude, Longitude"
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" onClick={handleGetGPS}>
                    <MapPin className="w-4 h-4 mr-2" />
                    Obter GPS
                  </Button>
                </div>
              </div>

              {/* Observações Gerais */}
              <div className="space-y-2">
                <Label htmlFor="observations">Observações Gerais (opcional)</Label>
                <Textarea
                  id="observations"
                  value={generalObservations}
                  onChange={(e) => setGeneralObservations(e.target.value)}
                  placeholder="Descreva as atividades realizadas, problemas encontrados, etc."
                  rows={4}
                />
              </div>

              {/* Fotos de Validação */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Image className="w-4 h-4" />
                  Fotos de Validação (opcional)
                </Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Tire fotos do local para validar a localização
                </p>
                <div className="space-y-3">
                  {validationPhotos.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {validationPhotos.map((photo, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={URL.createObjectURL(photo)}
                            alt={`Foto ${index + 1}`}
                            className="w-full h-24 object-cover rounded-md"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                            onClick={() => removePhoto(index)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <label className="block">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePhotoUpload}
                      className="hidden"
                      id="photo-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => document.getElementById('photo-upload')?.click()}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar Fotos
                    </Button>
                  </label>
                </div>
              </div>

                  <div className="flex gap-3">
                    <Button type="submit" className="flex-1" disabled={isLoading}>
                      {isLoading ? "Salvando..." : "Criar RDO"}
                    </Button>
                    {lastCreatedRDOId && (
                      <Button 
                        type="button" 
                        variant="outline"
                        onClick={exportRDOToPDF}
                        className="flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Exportar PDF
                      </Button>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            {selectedProject ? (
              <RDOHistoryView projectId={selectedProject} />
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <BarChart3 className="w-16 h-16 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Selecione um projeto para visualizar o histórico de RDOs
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
        </div>

        {/* Sidebar Direita */}
        <div className="lg:col-span-1 space-y-6">
          {/* Dados Climáticos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cloud className="w-5 h-5" />
                Dados Climáticos
              </CardTitle>
              <CardDescription>
                {isLoadingWeather ? "Carregando..." : weatherData ? "Dados atualizados" : "Aguardando localização"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingWeather ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Cloud className="w-16 h-16 text-muted-foreground mb-4 animate-pulse" />
                  <p className="text-sm text-muted-foreground">Obtendo dados climáticos...</p>
                </div>
              ) : weatherData ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Temperatura</span>
                    <span className="text-lg font-semibold">{weatherData.temperature}°C</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Umidade</span>
                    <span className="text-lg font-semibold">{weatherData.humidity}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Vento</span>
                    <span className="text-lg font-semibold">{weatherData.windSpeed} km/h</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Previsão de Chuva</span>
                    <span className={`text-lg font-semibold ${weatherData.willRain ? 'text-destructive' : 'text-green-600'}`}>
                      {weatherData.willRain ? 'Sim' : 'Não'}
                    </span>
                  </div>
                  <div className="pt-2 border-t">
                    <p className="text-sm text-center text-muted-foreground capitalize">
                      {weatherData.description}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8">
                  <Cloud className="w-16 h-16 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground text-center">
                    Clique em "Obter GPS" para ver os dados climáticos
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dicas */}
          <Card>
            <CardHeader>
              <CardTitle>Dicas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
                <p className="text-sm text-muted-foreground">
                  Registre o RDO diariamente para melhor controle
                </p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
                <p className="text-sm text-muted-foreground">
                  As fotos ajudam na validação da localização
                </p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
                <p className="text-sm text-muted-foreground">
                  Dados climáticos são salvos automaticamente
                </p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
                <p className="text-sm text-muted-foreground">
                  Descreva detalhadamente as atividades realizadas
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
        </div>
      </main>

      <AddServiceFrontDialog
        open={showServiceFrontDialog}
        onOpenChange={setShowServiceFrontDialog}
        projectId={selectedProject}
        onSuccess={async () => {
          await loadServiceFronts(selectedProject);
          setShowServiceFrontDialog(false);
          toast.success("Frente de serviço adicionada e disponível na lista!");
        }}
      />

      <AddConstructionSiteDialog
        open={showConstructionSiteDialog}
        onOpenChange={setShowConstructionSiteDialog}
        projectId={selectedProject}
        onSuccess={async () => {
          await loadConstructionSites(selectedProject);
          setShowConstructionSiteDialog(false);
          toast.success("Local de obra adicionado e disponível na lista!");
        }}
      />

      <AddServiceDialog
        open={showServiceDialog}
        onOpenChange={setShowServiceDialog}
        onSuccess={async () => {
          await loadServicesCatalog();
          setShowServiceDialog(false);
          toast.success("Serviço adicionado ao catálogo e disponível na lista!");
        }}
      />

      {/* Dialog Nova Pergunta */}
      <Dialog open={showNewQuestionDialog} onOpenChange={setShowNewQuestionDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Adicionar Nova Pergunta</DialogTitle>
            <DialogDescription>Crie uma pergunta customizada para o RDO</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newQuestion">Pergunta</Label>
              <Input
                id="newQuestion"
                value={newQuestionText}
                onChange={(e) => setNewQuestionText(e.target.value)}
                placeholder="Digite a pergunta..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="questionType">Tipo de Resposta</Label>
              <Select value={newQuestionType} onValueChange={(value: any) => setNewQuestionType(value)}>
                <SelectTrigger id="questionType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Texto</SelectItem>
                  <SelectItem value="number">Número</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowNewQuestionDialog(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={addCustomQuestion}>
                Adicionar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RDONew;