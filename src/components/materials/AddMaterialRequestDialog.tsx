import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface AddMaterialRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const AddMaterialRequestDialog = ({ open, onOpenChange, onSuccess }: AddMaterialRequestDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [serviceFronts, setServiceFronts] = useState<Array<{ id: string; name: string }>>([]);
  const [employees, setEmployees] = useState<Array<{ id: string; name: string }>>([]);
  const [formData, setFormData] = useState({
    projectId: "",
    serviceFrontId: "",
    employeeId: "",
    requestorName: "",
    materialName: "",
    quantity: "",
    unit: "",
    neededDate: "",
    usageLocation: "",
    requestDate: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    if (open) {
      fetchProjects();
    }
  }, [open]);

  useEffect(() => {
    if (formData.projectId) {
      fetchServiceFronts(formData.projectId);
      fetchEmployees(formData.projectId);
    }
  }, [formData.projectId]);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase.from("projects").select("id, name").order("name");

      if (error) throw error;
      setProjects(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar projetos: " + error.message);
    }
  };

  const fetchServiceFronts = async (projectId: string) => {
    try {
      const { data, error } = await supabase
        .from("service_fronts")
        .select("id, name")
        .eq("project_id", projectId)
        .order("name");

      if (error) throw error;
      setServiceFronts(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar frentes: " + error.message);
    }
  };

  const fetchEmployees = async (projectId: string) => {
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("id, name")
        .eq("project_id", projectId)
        .eq("status", "active")
        .order("name");

      if (error) throw error;
      setEmployees(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar funcionários: " + error.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.projectId || !formData.serviceFrontId || !formData.materialName || !formData.quantity || !formData.requestorName) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setIsLoading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      const { error } = await supabase.from("material_requests").insert({
        project_id: formData.projectId,
        service_front_id: formData.serviceFrontId,
        requested_by_employee_id: formData.employeeId || null,
        requestor_name: formData.requestorName,
        material_name: formData.materialName,
        quantity: parseFloat(formData.quantity),
        unit: formData.unit || null,
        needed_date: formData.neededDate || null,
        usage_location: formData.usageLocation || null,
        request_date: formData.requestDate,
        requested_by_user_id: userData.user.id,
        status: "pendente",
      });

      if (error) throw error;

      toast.success("Pedido de material criado com sucesso!");
      onOpenChange(false);
      onSuccess();
      setFormData({
        projectId: "",
        serviceFrontId: "",
        employeeId: "",
        requestorName: "",
        materialName: "",
        quantity: "",
        unit: "",
        neededDate: "",
        usageLocation: "",
        requestDate: new Date().toISOString().split("T")[0],
      });
    } catch (error: any) {
      toast.error("Erro ao criar pedido: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Pedido de Material</DialogTitle>
          <DialogDescription>Solicite materiais para o projeto</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="requestDate">Data do Pedido *</Label>
              <Input
                id="requestDate"
                type="date"
                value={formData.requestDate}
                onChange={(e) => setFormData({ ...formData, requestDate: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="project">Projeto *</Label>
              <Select value={formData.projectId} onValueChange={(value) => setFormData({ ...formData, projectId: value, serviceFrontId: "" })}>
                <SelectTrigger id="project">
                  <SelectValue placeholder="Selecione o projeto" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="serviceFront">Frente de Serviço *</Label>
              <Select value={formData.serviceFrontId} onValueChange={(value) => setFormData({ ...formData, serviceFrontId: value })} disabled={!formData.projectId}>
                <SelectTrigger id="serviceFront">
                  <SelectValue placeholder="Selecione a frente" />
                </SelectTrigger>
                <SelectContent>
                  {serviceFronts.map((front) => (
                    <SelectItem key={front.id} value={front.id}>
                      {front.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="requestorName">Nome do Solicitante *</Label>
              <Input
                id="requestorName"
                value={formData.requestorName}
                onChange={(e) => setFormData({ ...formData, requestorName: e.target.value })}
                placeholder="Nome de quem está solicitando"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="employee">Funcionário Solicitante (Opcional)</Label>
              <Select value={formData.employeeId} onValueChange={(value) => setFormData({ ...formData, employeeId: value })} disabled={!formData.projectId}>
                <SelectTrigger id="employee">
                  <SelectValue placeholder="Selecione o funcionário" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="materialName">Material *</Label>
              <Input
                id="materialName"
                value={formData.materialName}
                onChange={(e) => setFormData({ ...formData, materialName: e.target.value })}
                placeholder="Nome do material"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantidade *</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.01"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unidade</Label>
                <Input
                  id="unit"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  placeholder="m, kg, un"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="neededDate">Prazo (Quando Precisa)</Label>
              <Input
                id="neededDate"
                type="date"
                value={formData.neededDate}
                onChange={(e) => setFormData({ ...formData, neededDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="usageLocation">Onde Vai Ser Usado</Label>
              <Input
                id="usageLocation"
                value={formData.usageLocation}
                onChange={(e) => setFormData({ ...formData, usageLocation: e.target.value })}
                placeholder="Local de utilização"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Salvando..." : "Criar Pedido"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
