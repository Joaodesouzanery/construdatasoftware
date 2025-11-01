import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const formSchema = z.object({
  project_id: z.string().min(1, "Selecione um projeto"),
  team_name: z.string().min(1, "Nome da equipe é obrigatório"),
  report_date: z.date({
    required_error: "Data do relatório é obrigatória",
  }),
  address: z.string().min(1, "Endereço é obrigatório"),
  address_complement: z.string().optional(),
  client_name: z.string().min(1, "Nome do cliente é obrigatório"),
  water_meter_number: z.string().min(1, "Número do hidrômetro é obrigatório"),
  os_number: z.string().min(1, "Número da OS é obrigatório"),
  service_type: z.string().min(1, "Tipo de serviço é obrigatório"),
  observations: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface AddConnectionReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddConnectionReportDialog({
  open,
  onOpenChange,
}: AddConnectionReportDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [photos, setPhotos] = useState<File[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("status", "active")
        .order("name");

      if (error) throw error;
      return data || [];
    },
    enabled: !!session,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      team_name: "",
      report_date: new Date(),
      address: "",
      address_complement: "",
      client_name: "",
      water_meter_number: "",
      os_number: "",
      service_type: "",
      observations: "",
    },
  });

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newPhotos = Array.from(e.target.files);
      setPhotos((prev) => [...prev, ...newPhotos]);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadPhotos = async (userId: string): Promise<string[]> => {
    if (photos.length === 0) return [];

    setUploadingPhotos(true);
    const uploadedUrls: string[] = [];

    try {
      for (const photo of photos) {
        const fileExt = photo.name.split(".").pop();
        const fileName = `${userId}/${Date.now()}-${Math.random()}.${fileExt}`;

        const { error: uploadError, data } = await supabase.storage
          .from("connection-report-photos")
          .upload(fileName, photo);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("connection-report-photos")
          .getPublicUrl(fileName);

        uploadedUrls.push(publicUrl);
      }

      return uploadedUrls;
    } catch (error) {
      console.error("Error uploading photos:", error);
      throw error;
    } finally {
      setUploadingPhotos(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!session?.user?.id) throw new Error("No user session");

      const photoUrls = await uploadPhotos(session.user.id);

      const { error } = await supabase.from("connection_reports").insert({
        created_by_user_id: session.user.id,
        project_id: values.project_id,
        team_name: values.team_name,
        report_date: format(values.report_date, "yyyy-MM-dd"),
        address: values.address,
        address_complement: values.address_complement || null,
        client_name: values.client_name,
        water_meter_number: values.water_meter_number,
        os_number: values.os_number,
        service_type: values.service_type,
        observations: values.observations || null,
        photos_urls: photoUrls,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connection-reports"] });
      toast({
        title: "Sucesso!",
        description: "Relatório de ligação criado com sucesso.",
      });
      form.reset();
      setPhotos([]);
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Erro ao criar relatório de ligação.",
        variant: "destructive",
      });
      console.error(error);
    },
  });

  const onSubmit = (values: FormValues) => {
    createMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Relatório de Ligação</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="project_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Projeto</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um projeto" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="team_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Equipe</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Ex: Equipe A" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="report_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Data do Relatório</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP", { locale: ptBR })
                          ) : (
                            <span>Selecione a data</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Endereço</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Rua, número" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address_complement"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Complemento do Endereço</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Apto, bloco, etc." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="client_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Cliente</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Nome completo do cliente" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="water_meter_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número do Hidrômetro</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Ex: 123456789" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="os_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número da OS</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Ex: OS-2024-001" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="service_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Serviço</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Ex: Instalação, Manutenção, etc." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel>Fotos do Relatório</FormLabel>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById("photo-upload")?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Adicionar Fotos
                </Button>
                <input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handlePhotoChange}
                />
              </div>
              {photos.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {photos.map((photo, index) => (
                    <div key={index} className="relative">
                      <img
                        src={URL.createObjectURL(photo)}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-24 object-cover rounded"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6"
                        onClick={() => removePhoto(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <FormField
              control={form.control}
              name="observations"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Observações gerais sobre o relatório"
                      rows={4}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || uploadingPhotos}
              >
                {createMutation.isPending || uploadingPhotos ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {uploadingPhotos ? "Enviando fotos..." : "Criando..."}
                  </>
                ) : (
                  "Criar Relatório"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
