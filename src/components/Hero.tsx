import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Shield } from "lucide-react";
import { ContactDialog } from "@/components/ContactDialog";

const Hero = () => {
  const navigate = useNavigate();
  const [showContactDialog, setShowContactDialog] = useState(false);

  useEffect(() => {
    // Mostrar o pop-up após 3 segundos
    const timer = setTimeout(() => {
      setShowContactDialog(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen">
      {/* Top Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="text-xl font-bold">ConstruData</div>
          <div className="flex gap-3">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/auth')}
            >
              Entrar
            </Button>
            <Button 
              onClick={() => navigate('/system-test')}
            >
              Adquirir
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section - BLOCO 1 */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-primary/5 via-background to-secondary/5 pt-20">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="container mx-auto px-4 z-10">
          <div className="max-w-5xl mx-auto text-center space-y-8">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
              O Sistema Operacional da Sua Obra e da Sua Manutenção Predial
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
              Centralize obras, equipes, materiais e manutenção em um único lugar — com RDO completo, QR Codes, alertas automáticos, dashboard e registros em tempo real.
            </p>
            
            {/* Bullets */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-3xl mx-auto text-left">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-sm md:text-base">Centralize operações</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-sm md:text-base">Elimine atrasos</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-sm md:text-base">Reduza desperdícios</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-sm md:text-base">Controle equipes e materiais</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-sm md:text-base">Rastreie ativos com QR Code</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-sm md:text-base">Registre obra e manutenção em tempo real</span>
              </div>
            </div>

            <div className="flex flex-col items-center gap-4 pt-8">
              <Button 
                size="lg" 
                className="text-lg px-8 py-6 rounded-full shadow-lg hover:shadow-xl transition-all"
                onClick={() => navigate('/system-test')}
              >
                Teste Grátis do Sistema
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="text-lg px-8 py-6 rounded-full"
                onClick={() => navigate('/auth')}
              >
                Quero ver o Construdata na prática
              </Button>
              <p className="text-sm text-muted-foreground">
                Demonstração rápida e sem compromisso.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section - DOR - BLOCO 3 */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <h2 className="text-4xl md:text-5xl font-bold">
              Sua obra não atrasa por falta de esforço.<br />
              Ela atrasa por falta de VISIBILIDADE.
            </h2>
            <p className="text-xl text-muted-foreground">
              E você sabe disso. Sem controle real, tudo vira improviso e adivinhação.
            </p>
            
            <div className="grid md:grid-cols-2 gap-4 text-left pt-8">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/5">
                <span className="text-2xl">❌</span>
                <span>Planilhas desatualizadas</span>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/5">
                <span className="text-2xl">❌</span>
                <span>Equipe perdida</span>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/5">
                <span className="text-2xl">❌</span>
                <span>Comunicação no WhatsApp</span>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/5">
                <span className="text-2xl">❌</span>
                <span>Falta de fotos e evidências</span>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/5">
                <span className="text-2xl">❌</span>
                <span>Desperdício que não se rastreia</span>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/5">
                <span className="text-2xl">❌</span>
                <span>RDO incompleto</span>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/5">
                <span className="text-2xl">❌</span>
                <span>Chamados de manutenção que somem</span>
              </div>
            </div>

            <p className="text-2xl font-bold pt-8">
              Obra sem sistema vira achismo.<br />
              E achismo custa caro.
            </p>
          </div>
        </div>
      </section>

      {/* Posicionamento - BLOCO 4 */}
      <section className="py-24 bg-gradient-to-br from-primary/5 to-secondary/5">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h2 className="text-4xl md:text-5xl font-bold">
              O Construdata centraliza tudo e coloca ordem na operação.
            </h2>
            <p className="text-xl text-muted-foreground">
              Cada obra, funcionário, material, ativo e tarefa aparece em um painel único — com dados reais, evidência, fotos, alertas e rastreabilidade.
              É operação profissional, do jeito que deveria ser.
            </p>
          </div>
        </div>
      </section>

      {/* Pilares do Produto - BLOCO 5 */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
            Funcionalidades Completas
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Pilar 1 */}
            <div className="p-6 rounded-lg border bg-card hover:shadow-lg transition-shadow flex flex-col">
              <h3 className="text-xl font-bold mb-4">Controle de Obra</h3>
              <ul className="space-y-2 text-sm text-muted-foreground flex-1">
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✔</span>
                  <span>Dashboard de obras</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✔</span>
                  <span>Projetos e alertas</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✔</span>
                  <span>RDO completo com fotos</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✔</span>
                  <span>Controle de produção</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✔</span>
                  <span>Histórico e relatórios</span>
                </li>
              </ul>
              <Button variant="outline" className="mt-4 w-full" onClick={() => navigate('/features/controle-de-obra')}>
                Saiba Mais
              </Button>
            </div>

            {/* Pilar 2 */}
            <div className="p-6 rounded-lg border bg-card hover:shadow-lg transition-shadow flex flex-col">
              <h3 className="text-xl font-bold mb-4">Materiais & Almoxarifado</h3>
              <ul className="space-y-2 text-sm text-muted-foreground flex-1">
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✔</span>
                  <span>Estoque atualizado</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✔</span>
                  <span>Pedidos de material</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✔</span>
                  <span>Entradas e saídas</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✔</span>
                  <span>Consumo por obra, equipe e tarefa</span>
                </li>
              </ul>
              <Button variant="outline" className="mt-4 w-full" onClick={() => navigate('/features/materiais-almoxarifado')}>
                Saiba Mais
              </Button>
            </div>

            {/* Pilar 3 */}
            <div className="p-6 rounded-lg border bg-card hover:shadow-lg transition-shadow flex flex-col">
              <h3 className="text-xl font-bold mb-4">Execução & Equipes</h3>
              <ul className="space-y-2 text-sm text-muted-foreground flex-1">
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✔</span>
                  <span>Gestão de funcionários</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✔</span>
                  <span>Checklists operacionais</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✔</span>
                  <span>Registros diários com evidências</span>
                </li>
              </ul>
              <Button variant="outline" className="mt-4 w-full" onClick={() => navigate('/features/execucao-equipes')}>
                Saiba Mais
              </Button>
            </div>

            {/* Pilar 4 */}
            <div className="p-6 rounded-lg border bg-card hover:shadow-lg transition-shadow flex flex-col">
              <h3 className="text-xl font-bold mb-4">Manutenção Predial</h3>
              <ul className="space-y-2 text-sm text-muted-foreground flex-1">
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✔</span>
                  <span>Catálogo de ativos</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✔</span>
                  <span>QR Codes</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✔</span>
                  <span>Solicitações de manutenção</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✔</span>
                  <span>Histórico completo</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✔</span>
                  <span>Relatórios e alertas</span>
                </li>
              </ul>
              <Button variant="outline" className="mt-4 w-full" onClick={() => navigate('/features/manutencao-predial')}>
                Saiba Mais
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Problema → Solução - BLOCO 6 */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
              Problema → Solução
            </h2>
            
            <div className="grid md:grid-cols-2 gap-12 items-start">
              {/* Problemas */}
              <div className="space-y-6">
                <h3 className="text-2xl font-bold text-destructive mb-6">Problemas Típicos:</h3>
                <div className="space-y-4">
                  <ProblemItem icon="📋" text="Planilhas desatualizadas e dados espalhados" />
                  <ProblemItem icon="💸" text="Desperdício de materiais não rastreado" />
                  <ProblemItem icon="⏰" text="Atrasos constantes por falta de visibilidade" />
                  <ProblemItem icon="📱" text="Comunicação perdida no WhatsApp" />
                  <ProblemItem icon="❓" text="Chamados de manutenção que somem" />
                  <ProblemItem icon="🤷" text="Sem evidências fotográficas organizadas" />
                </div>
              </div>

              {/* Benefícios */}
              <div className="space-y-6">
                <h3 className="text-2xl font-bold text-green-600 mb-6">Com o ConstruData:</h3>
                <div className="space-y-4">
                  <BenefitItem icon="✓" text="Todos os dados centralizados em tempo real" />
                  <BenefitItem icon="✓" text="Controle preciso de entrada e saída de materiais" />
                  <BenefitItem icon="✓" text="Visibilidade total do progresso de cada frente" />
                  <BenefitItem icon="✓" text="Histórico completo e organizado de comunicações" />
                  <BenefitItem icon="✓" text="QR Codes para rastreamento de ativos e chamados" />
                  <BenefitItem icon="✓" text="Galeria de fotos por obra, tarefa e data" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Como Funciona - BLOCO 7 */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
              Como Funciona
            </h2>
            
            <div className="space-y-8">
              <MethodologyCard
                number="1"
                title="Cadastre suas obras e equipes"
                description="Configure projetos, funcionários e materiais em minutos. Importe dados de planilhas se necessário."
              />
              <MethodologyCard
                number="2"
                title="Registre em tempo real"
                description="Equipes registram produção, materiais e ocorrências direto do celular. Com fotos, GPS e hora."
              />
              <MethodologyCard
                number="3"
                title="Acompanhe no dashboard"
                description="Gestores veem tudo centralizado: custos, produtividade, alertas e indicadores em tempo real."
              />
              <MethodologyCard
                number="4"
                title="Exporte relatórios completos"
                description="RDOs, relatórios de consumo, histórico de manutenção — tudo pronto para enviar ao cliente."
              />
            </div>

            <div className="mt-12 p-6 bg-card border rounded-lg">
              <h3 className="text-xl font-bold mb-4">O que está incluso:</h3>
              <ul className="grid md:grid-cols-2 gap-3 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✔</span>
                  <span>Usuários ilimitados</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✔</span>
                  <span>Armazenamento de fotos e documentos</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✔</span>
                  <span>Acesso via web e mobile</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✔</span>
                  <span>Suporte técnico incluído</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✔</span>
                  <span>Atualizações automáticas</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✔</span>
                  <span>Backup diário automático</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Garantia / Segurança - BLOCO 8 */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 text-green-500 border border-green-500/20 backdrop-blur-sm mb-4">
                <Shield className="w-4 h-4" />
                <span className="text-sm font-semibold">100% Seguro e Confiável</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Seus dados protegidos
              </h2>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8 mb-12">
              <SecurityFeature
                icon="🔐"
                title="Criptografia de ponta a ponta"
                description="Todos os dados são criptografados com tecnologia bancária. Ninguém acessa suas informações sem autorização."
              />
              <SecurityFeature
                icon="🛡️"
                title="Conformidade LGPD"
                description="Sistema totalmente adequado à Lei Geral de Proteção de Dados. Seus dados e dos seus clientes protegidos."
              />
              <SecurityFeature
                icon="☁️"
                title="Backup automático diário"
                description="Seus dados são salvos automaticamente todos os dias. Recuperação disponível a qualquer momento."
              />
              <SecurityFeature
                icon="🔒"
                title="Controle de acesso"
                description="Defina permissões por usuário. Cada pessoa vê apenas o que precisa para seu trabalho."
              />
            </div>

            <div className="text-center p-8 bg-gradient-to-br from-green-500/10 to-blue-500/10 rounded-lg border border-green-500/20">
              <h3 className="text-2xl font-bold mb-4">Garantia de Satisfação</h3>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Teste sem compromisso. Se não funcionar para você, sem problemas. 
                Estamos aqui para resolver problemas reais, não para criar mais dor de cabeça.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Quebra de Objeções - BLOCO 9 */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
              Objeções que você talvez tenha — e que resolvemos logo de cara:
            </h2>
            <div className="space-y-6">
              <div className="p-6 rounded-lg border bg-card">
                <h3 className="font-bold text-lg mb-2">"Minha equipe não vai usar."</h3>
                <p className="text-muted-foreground">
                  O Construdata foi feito para o campo: simples, rápido e direto. Registro por foto e QR Code.
                </p>
              </div>
              <div className="p-6 rounded-lg border bg-card">
                <h3 className="font-bold text-lg mb-2">"Já tentei outros softwares e ninguém adotou."</h3>
                <p className="text-muted-foreground">
                  Nosso onboarding é guiado. Em 7 dias você já vê resultado real.
                </p>
              </div>
              <div className="p-6 rounded-lg border bg-card">
                <h3 className="font-bold text-lg mb-2">"Isso deve dar trabalho para implementar."</h3>
                <p className="text-muted-foreground">
                  A implementação é por etapas e acompanhada. Não deixa ninguém travado.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security Trust Section - BLOCO 10 */}
      <section id="security" className="py-24 bg-gradient-to-br from-primary/5 to-secondary/5">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 text-green-500 border border-green-500/20 backdrop-blur-sm mb-4">
                <Shield className="w-4 h-4" />
                <span className="text-sm font-semibold">Segurança Empresarial</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Segurança e Confiabilidade
              </h2>
              <p className="text-xl text-muted-foreground">
                Seus dados protegidos com tecnologia de ponta
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
              <SecurityFeature
                icon="🔐"
                title="Autenticação Segura"
                description="Login protegido com criptografia de ponta a ponta e autenticação de dois fatores disponível"
              />
              <SecurityFeature
                icon="🗄️"
                title="Isolamento de Dados"
                description="Cada projeto tem seus próprios dados completamente isolados e protegidos"
              />
              <SecurityFeature
                icon="🔒"
                title="APIs Protegidas"
                description="Todas as comunicações são criptografadas e validadas com tokens seguros"
              />
              <SecurityFeature
                icon="📊"
                title="Backup Automático"
                description="Seus dados são automaticamente salvos e podem ser recuperados a qualquer momento"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA - BLOCO 9 */}
      <section className="py-24 bg-gradient-to-br from-primary via-primary/90 to-primary text-primary-foreground">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <h2 className="text-4xl md:text-5xl font-bold">
              Chega de operar no escuro.<br />
              Controle sua obra e sua manutenção com profissionalismo.
            </h2>
            <Button 
              size="lg" 
              variant="secondary"
              className="text-lg px-8 py-6 rounded-full shadow-lg hover:shadow-xl transition-all"
              onClick={() => navigate('/auth')}
            >
              Quero ver o Construdata na prática
            </Button>
            <p className="text-primary-foreground/80">
              Demonstração rápida. Sem compromisso.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Dialog */}
      <ContactDialog open={showContactDialog} onOpenChange={setShowContactDialog} />
    </div>
  );
};

const SecurityFeature = ({ icon, title, description }: { icon: string; title: string; description: string }) => (
  <div className="p-6 rounded-lg border bg-card hover:shadow-lg transition-shadow">
    <div className="text-4xl mb-4">{icon}</div>
    <h3 className="text-lg font-bold mb-2">{title}</h3>
    <p className="text-sm text-muted-foreground">{description}</p>
  </div>
);

const ProblemItem = ({ icon, text }: { icon: string; text: string }) => (
  <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/5 border border-destructive/20">
    <span className="text-2xl flex-shrink-0">{icon}</span>
    <span className="text-base">{text}</span>
  </div>
);

const BenefitItem = ({ icon, text }: { icon: string; text: string }) => (
  <div className="flex items-start gap-3 p-4 rounded-lg bg-green-500/5 border border-green-500/20">
    <span className="text-2xl flex-shrink-0 text-green-600">{icon}</span>
    <span className="text-base">{text}</span>
  </div>
);

const MethodologyCard = ({ number, title, description }: { number: string; title: string; description: string }) => (
  <div className="flex gap-6 items-start p-6 rounded-lg border bg-card">
    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold">
      {number}
    </div>
    <div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  </div>
);

export default Hero;
