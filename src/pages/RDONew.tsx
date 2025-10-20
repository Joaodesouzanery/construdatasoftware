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
import { Building2, Plus, Trash2, FileText, BarChart3, Eye, MapPin, Image, Cloud } from "lucide-react";
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
  const [searchParams] = useSearchParams();
  const isDemoMode = searchParams.get('demo') === 'true';
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Data from database
  const [projects, setProjects] = useState<any[]>([]);
  const [serviceFronts, setServiceFronts] = useState<any[]>([]);
  const [constructionSites, setConstructionSites] = useState<any[]>([]);
  const [servicesCatalog, setServicesCatalog] = useState<any[]>([]);
  const [productionTargets, setProductionTargets] = useState<any[]>([]);

  // Form state
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedServiceFront, setSelectedServiceFront] = useState<string>("");
  const [selectedConstructionSite, setSelectedConstructionSite] = useState<string>("");
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

  // Dialog states
  const [showServiceFrontDialog, setShowServiceFrontDialog] = useState(false);
  const [showConstructionSiteDialog, setShowConstructionSiteDialog] = useState(false);
  const [showServiceDialog, setShowServiceDialog] = useState(false);

  useEffect(() => {
    checkAuth();
    loadProjects();
    loadServicesCatalog();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      loadServiceFronts(selectedProject);
      loadConstructionSites(selectedProject);
    }
  }, [selectedProject]);

  useEffect(() => {
    if (selectedServiceFront) {
      loadProductionTargets(selectedServiceFront);
    }
  }, [selectedServiceFront]);

  const checkAuth = async () => {
    if (isDemoMode) {
      const { demoUser } = await import("@/lib/demo-data");
      setUser(demoUser);
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth');
      return;
    }
    setUser(session.user);
  };

  const loadProjects = async () => {
    if (isDemoMode) {
      const { demoProjects } = await import("@/lib/demo-data");
      setProjects(demoProjects);
      if (demoProjects.length > 0) {
        setSelectedProject(demoProjects[0].id);
      }
      return;
    }

    const { data } = await supabase
      .from('projects')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    if (data) setProjects(data);
  };

  const loadServiceFronts = async (projectId: string) => {
    if (isDemoMode) {
      setServiceFronts([
        { id: "sf-1", name: "Fundação", project_id: projectId },
        { id: "sf-2", name: "Estrutura", project_id: projectId },
        { id: "sf-3", name: "Alvenaria", project_id: projectId }
      ]);
      return;
    }

    const { data } = await supabase
      .from('service_fronts')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (data) setServiceFronts(data);
  };

  const loadConstructionSites = async (projectId: string) => {
    if (isDemoMode) {
      const { demoConstructionSites } = await import("@/lib/demo-data");
      setConstructionSites(demoConstructionSites);
      return;
    }

    const { data } = await supabase
      .from('construction_sites')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (data) setConstructionSites(data);
  };

  const loadServicesCatalog = async () => {
    if (isDemoMode) {
      setServicesCatalog([
        { id: "s-1", name: "Escavação", unit: "m³" },
        { id: "s-2", name: "Concretagem", unit: "m³" },
        { id: "s-3", name: "Alvenaria", unit: "m²" },
        { id: "s-4", name: "Reboco", unit: "m²" }
      ]);
      return;
    }

    const { data } = await supabase
      .from('services_catalog')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setServicesCatalog(data);
  };

  const loadProductionTargets = async (serviceFrontId: string) => {
    if (isDemoMode) {
      setProductionTargets([
        { id: "pt-1", service_id: "s-1", target_quantity: 50, target_date: new Date().toISOString().split('T')[0] },
        { id: "pt-2", service_id: "s-2", target_quantity: 30, target_date: new Date().toISOString().split('T')[0] }
      ]);
      return;
    }

    const { data } = await supabase
      .from('production_targets')
      .select('*')
      .eq('service_front_id', serviceFrontId)
      .order('created_at', { ascending: false });
    if (data) setProductionTargets(data);
  };

  const addExecutedService = () => {
    setExecutedServices([...executedServices, { service_id: "", quantity: "", unit: "", equipment_used: "" }]);
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
        (position) => {
          const lat = position.coords.latitude.toFixed(6);
          const lng = position.coords.longitude.toFixed(6);
          setLocation(`${lat}, ${lng}`);
          toast.success("Localização obtida com sucesso!");
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
    
    if (isDemoMode) {
      toast.success("RDO criado com sucesso no modo demo!");
      setExecutedServices([{ service_id: "", quantity: "", unit: "", equipment_used: "" }]);
      return;
    }

    if (!selectedProject || !selectedServiceFront || !selectedConstructionSite) {
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
      // Create daily report
      const { data: dailyReport, error: reportError } = await supabase
        .from('daily_reports')
        .insert([{
          report_date: reportDate,
          project_id: selectedProject,
          construction_site_id: selectedConstructionSite,
          service_front_id: selectedServiceFront,
          executed_by_user_id: user.id
        }])
        .select()
        .single();

      if (reportError) throw reportError;

      // Insert executed services
      for (const service of validServices) {
        const { data: executedService, error: serviceError } = await supabase
          .from('executed_services')
          .insert([{
            daily_report_id: dailyReport.id,
            service_id: service.service_id,
            quantity: parseFloat(service.quantity),
            unit: service.unit,
            equipment_used: service.equipment_used ? { equipment: service.equipment_used } : null,
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

      toast.success("RDO criado com sucesso!");
      
      // Reset form
      setSelectedServiceFront("");
      setSelectedConstructionSite("");
      setReportDate(new Date().toISOString().split('T')[0]);
      setExecutedServices([{ service_id: "", quantity: "", unit: "", equipment_used: "" }]);
      
    } catch (error: any) {
      toast.error("Erro ao criar RDO: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate(isDemoMode ? '/dashboard?demo=true' : '/dashboard')}>
              <Building2 className="w-6 h-6 mr-2" />
              <span className="font-bold">ConstruData</span>
            </Button>
            <h1 className="text-xl font-semibold">Relatório Diário de Obra (RDO)</h1>
            {isDemoMode && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full flex items-center gap-1">
                <Eye className="w-3 h-3" />
                Demo
              </span>
            )}
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="project">Projeto *</Label>
                  <Select value={selectedProject} onValueChange={setSelectedProject}>
                    <SelectTrigger id="project">
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

              {/* Quadros Selecionáveis */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Informações do RDO</h3>
                
                {/* Quadro 1: Frente de Serviço */}
                <Card className="border-2 border-primary/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">1. Frente de Serviço *</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Select 
                      value={selectedServiceFront} 
                      onValueChange={setSelectedServiceFront}
                      disabled={!selectedProject}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a frente de serviço" />
                      </SelectTrigger>
                      <SelectContent>
                        {serviceFronts.map(front => (
                          <SelectItem key={front.id} value={front.id}>
                            {front.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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

                {/* Quadro 2: Local da Obra */}
                <Card className="border-2 border-primary/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">2. Local da Obra *</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Select 
                      value={selectedConstructionSite} 
                      onValueChange={setSelectedConstructionSite}
                      disabled={!selectedProject}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o local da obra" />
                      </SelectTrigger>
                      <SelectContent>
                        {constructionSites.map(site => (
                          <SelectItem key={site.id} value={site.id}>
                            {site.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                              <Label>Equipamentos Utilizados</Label>
                              <Input
                                value={service.equipment_used}
                                onChange={(e) => updateExecutedService(index, 'equipment_used', e.target.value)}
                                placeholder="Betoneira, Vibrador..."
                              />
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

              {/* Condição do Terreno */}
              <Card className="border-2 border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Condição do Terreno</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={terrainCondition} onValueChange={setTerrainCondition}>
                    <SelectTrigger>
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
                </CardContent>
              </Card>

              {/* Localização */}
              <Card className="border-2 border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Localização</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Input
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
                </CardContent>
              </Card>

              {/* Observações Gerais */}
              <Card className="border-2 border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Observações Gerais</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={generalObservations}
                    onChange={(e) => setGeneralObservations(e.target.value)}
                    placeholder="Descreva as atividades realizadas, problemas encontrados, etc."
                    rows={4}
                  />
                </CardContent>
              </Card>

              {/* Fotos de Validação */}
              <Card className="border-2 border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Image className="w-4 h-4" />
                    Fotos de Validação
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Tire fotos do local para validar a localização
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
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
                          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removePhoto(index)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
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
                </CardContent>
              </Card>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Salvando..." : "Criar RDO"}
                  </Button>
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
              <CardDescription>Aguardando localização</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Cloud className="w-16 h-16 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground text-center">
                Selecione uma obra e obtenha a localização para ver os dados climáticos
              </p>
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
        onSuccess={() => {
          loadServiceFronts(selectedProject);
          setShowServiceFrontDialog(false);
        }}
      />

      <AddConstructionSiteDialog
        open={showConstructionSiteDialog}
        onOpenChange={setShowConstructionSiteDialog}
        projectId={selectedProject}
        onSuccess={() => {
          loadConstructionSites(selectedProject);
          setShowConstructionSiteDialog(false);
        }}
      />

      <AddServiceDialog
        open={showServiceDialog}
        onOpenChange={setShowServiceDialog}
        onSuccess={() => {
          loadServicesCatalog();
          setShowServiceDialog(false);
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