import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Plus, Trash2, FileText, BarChart3 } from "lucide-react";
import { toast } from "sonner";
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

  // Form state
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedServiceFront, setSelectedServiceFront] = useState<string>("");
  const [selectedConstructionSite, setSelectedConstructionSite] = useState<string>("");
  const [reportDate, setReportDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [executedServices, setExecutedServices] = useState<ExecutedService[]>([
    { service_id: "", quantity: "", unit: "", equipment_used: "" }
  ]);

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

  const loadProductionTargets = async (serviceFrontId: string) => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
            <Button variant="ghost" onClick={() => navigate('/dashboard')}>
              <Building2 className="w-6 h-6 mr-2" />
              <span className="font-bold">ConstruData</span>
            </Button>
            <h1 className="text-xl font-semibold">Relatório Diário de Obra (RDO)</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="create" className="max-w-6xl mx-auto">
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

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="serviceFront">Frente de Serviço *</Label>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowServiceFrontDialog(true)}
                    disabled={!selectedProject}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Adicionar Nova Frente
                  </Button>
                </div>
                <Select 
                  value={selectedServiceFront} 
                  onValueChange={setSelectedServiceFront}
                  disabled={!selectedProject}
                >
                  <SelectTrigger id="serviceFront">
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
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="constructionSite">Local da Obra *</Label>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowConstructionSiteDialog(true)}
                    disabled={!selectedProject}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Adicionar Novo Local
                  </Button>
                </div>
                <Select 
                  value={selectedConstructionSite} 
                  onValueChange={setSelectedConstructionSite}
                  disabled={!selectedProject}
                >
                  <SelectTrigger id="constructionSite">
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
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Serviços Executados *</Label>
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

                {executedServices.map((service, index) => (
                  <Card key={index} className="p-4">
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
              </div>

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
    </div>
  );
};

export default RDONew;