import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Building2, Eye, CheckCircle2 } from "lucide-react";
import { z } from "zod";
import { PasswordStrengthIndicator, calculatePasswordStrength } from "@/components/auth/PasswordStrengthIndicator";

// Strong password validation schema
const signUpSchema = z.object({
  name: z.string()
    .trim()
    .min(3, "Nome deve ter pelo menos 3 caracteres")
    .max(100, "Nome muito longo"),
  email: z.string()
    .trim()
    .email("Email inválido")
    .max(255, "Email muito longo"),
  password: z.string()
    .min(8, "Senha deve ter pelo menos 8 caracteres")
    .max(128, "Senha muito longa")
    .refine((pwd) => /[A-Z]/.test(pwd), {
      message: "Senha deve conter pelo menos uma letra maiúscula"
    })
    .refine((pwd) => /[a-z]/.test(pwd), {
      message: "Senha deve conter pelo menos uma letra minúscula"
    })
    .refine((pwd) => /\d/.test(pwd), {
      message: "Senha deve conter pelo menos um número"
    })
});

const signInSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Senha é obrigatória")
});

const Auth = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    // Check if user is already logged in
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate('/dashboard');
      }
    };
    
    checkSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate('/dashboard');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validar inputs
      const validationResult = signUpSchema.safeParse({
        name: name.trim(),
        email: email.trim(),
        password
      });

      if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        toast.error(firstError.message);
        setIsLoading(false);
        return;
      }

      const { error, data } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            name: name.trim(),
          }
        }
      });

      if (error) {
        // Mensagens de erro mais amigáveis
        if (error.message.includes("already registered")) {
          toast.error("Este email já está cadastrado. Faça login ou use outro email.");
        } else if (error.message.includes("password")) {
          toast.error("Senha inválida. Use pelo menos 6 caracteres.");
        } else {
          toast.error(error.message);
        }
        return;
      }

      // Sucesso no cadastro
      toast.success("Conta criada com sucesso!", {
        description: "Você já está logado e pode começar a usar o sistema.",
        icon: <CheckCircle2 className="w-5 h-5 text-green-500" />
      });
      
      // Limpar campos
      setEmail("");
      setPassword("");
      setName("");
      
      // Redirecionar após um pequeno delay
      setTimeout(() => {
        navigate('/dashboard');
      }, 1000);
    } catch (error: any) {
      console.error("Signup error:", error);
      toast.error("Erro ao criar conta. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validar inputs
      const validationResult = signInSchema.safeParse({
        email: email.trim(),
        password
      });

      if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        toast.error(firstError.message);
        setIsLoading(false);
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        // Mensagens de erro mais amigáveis
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Email ou senha incorretos. Verifique seus dados.");
        } else if (error.message.includes("Email not confirmed")) {
          toast.error("Confirme seu email antes de fazer login.");
        } else {
          toast.error(error.message);
        }
        return;
      }

      toast.success("Login realizado com sucesso!");
      navigate('/dashboard');
    } catch (error: any) {
      console.error("Login error:", error);
      toast.error("Erro ao fazer login. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-3 sm:p-4">
      <Card className="w-full max-w-md shadow-card">
        <CardHeader className="space-y-3 sm:space-y-4">
          <div className="flex items-center justify-center gap-2 text-primary">
            <Building2 className="w-7 h-7 sm:w-8 sm:h-8" />
            <span className="text-xl sm:text-2xl font-bold">ConstruData</span>
          </div>
          <div className="text-center">
            <CardTitle className="text-lg sm:text-xl">Bem-vindo</CardTitle>
            <CardDescription className="text-sm">Faça login ou crie sua conta para continuar</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login" className="text-sm">Login</TabsTrigger>
              <TabsTrigger value="signup" className="text-sm">Criar Conta</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Senha</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Entrando..." : "Entrar"}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Nome</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Seu nome"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Senha</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    minLength={8}
                  />
                  <PasswordStrengthIndicator password={password} />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Criando conta..." : "Criar Conta"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
