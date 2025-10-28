import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Plus, ListTodo } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddTaskDialog } from "@/components/facility/AddTaskDialog";
import { TaskKanbanBoard } from "@/components/facility/TaskKanbanBoard";

interface Task {
  id: string;
  task_type: string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  deadline?: string;
  asset_id?: string;
  assigned_to_employee_id?: string;
  created_at: string;
  assets_catalog?: {
    name: string;
  };
  employees?: {
    name: string;
  };
}

const MaintenanceTasks = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskType, setTaskType] = useState<"preventiva" | "corretiva">("preventiva");

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    setUser(user);
    loadTasks();
  };

  const loadTasks = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("maintenance_tasks")
        .select(`
          *,
          assets_catalog (
            name
          ),
          employees (
            name
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar tarefas",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const preventiveTasks = tasks.filter((t) => t.task_type === "preventiva");
  const correctiveTasks = tasks.filter((t) => t.task_type === "corretiva");

  const getStatusCount = (taskList: Task[], status: string) => {
    return taskList.filter((t) => t.status === status).length;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <ListTodo className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Painel de Tarefas</h1>
            <p className="text-muted-foreground">
              Gerencie manutenções preventivas e corretivas
            </p>
          </div>
          <Button onClick={() => {
            setSelectedTask(null);
            setShowAddDialog(true);
          }}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Tarefa
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total de Tarefas
              </CardTitle>
              <ListTodo className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tasks.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {getStatusCount(tasks, "pendente")}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Em Processo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {getStatusCount(tasks, "em_processo")}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Concluídas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {getStatusCount(tasks, "concluida")}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="preventiva" onValueChange={(v) => setTaskType(v as any)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="preventiva">
              Manutenções Preventivas
            </TabsTrigger>
            <TabsTrigger value="corretiva">
              Manutenções Corretivas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="preventiva" className="mt-6">
            <TaskKanbanBoard
              tasks={preventiveTasks}
              onTaskUpdate={loadTasks}
              onTaskClick={(task) => {
                setSelectedTask(task);
                setShowAddDialog(true);
              }}
            />
          </TabsContent>

          <TabsContent value="corretiva" className="mt-6">
            <TaskKanbanBoard
              tasks={correctiveTasks}
              onTaskUpdate={loadTasks}
              onTaskClick={(task) => {
                setSelectedTask(task);
                setShowAddDialog(true);
              }}
            />
          </TabsContent>
        </Tabs>
      </div>

      <AddTaskDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        task={selectedTask}
        defaultTaskType={taskType}
        onSuccess={loadTasks}
      />
    </div>
  );
};

export default MaintenanceTasks;
