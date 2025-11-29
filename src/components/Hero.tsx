import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Shield, Check, X, Lock, Server, FileCheck, AlertTriangle, Clock, TrendingUp } from "lucide-react";
import { ContactDialog } from "@/components/ContactDialog";

const Hero = () => {
  const navigate = useNavigate();
  const [showContactDialog, setShowContactDialog] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowContactDialog(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-black/80 backdrop-blur-md border-b border-white/10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight">CONSTRUDATA</h2>
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              className="text-white hover:text-[#FFA500] hover:bg-white/5"
              onClick={() => navigate('/auth')}
            >
              ENTRAR
            </Button>
            <Button 
              className="bg-[#FFA500] text-black hover:bg-[#FF8C00] font-bold"
              onClick={() => navigate('/system-test')}
            >
              CRIAR CONTA
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-black to-[#1a1a1a]" />
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0" style={{
            backgroundImage: 'linear-gradient(rgba(255, 165, 0, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 165, 0, 0.05) 1px, transparent 1px)',
            backgroundSize: '100px 100px'
          }} />
        </div>
        
        <div className="container mx-auto px-4 z-10 py-20">
          <div className="max-w-5xl mx-auto text-center space-y-8">
            <div className="inline-block mb-4">
              <span className="text-[#FFA500] text-sm font-bold tracking-wider uppercase px-4 py-2 border border-[#FFA500]/30 rounded-full">
                Sistema Operacional para Obras e Manutenção
              </span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight">
              CONTROLE TOTAL DA SUA <span className="text-[#FFA500]">OBRA</span><br />
              EM MINUTOS, NÃO SEMANAS
            </h1>
            
            <p className="text-xl md:text-2xl text-gray-400 max-w-3xl mx-auto">
              Enquanto outros engenheiros perdem dias em planilhas e WhatsApp, você resolve tudo em um sistema único com RDO automático, controle de materiais e alertas inteligentes.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
              <Button 
                size="lg" 
                className="bg-[#FFA500] text-black hover:bg-[#FF8C00] text-lg px-10 py-7 rounded-full font-bold shadow-2xl shadow-[#FFA500]/20"
                onClick={() => navigate('/system-test')}
              >
                🔥 COMEÇAR AGORA
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="border-white/20 text-white hover:bg-white/5 text-lg px-10 py-7 rounded-full font-bold"
                onClick={() => navigate('/auth')}
              >
                VER DEMONSTRAÇÃO
              </Button>
            </div>

            <p className="text-sm text-gray-500 pt-4">
              ✓ Demonstração instantânea • ✓ Sem cartão de crédito
            </p>
          </div>
        </div>
      </section>

      {/* Integration Logos */}
      <section className="py-16 bg-black border-y border-white/10">
        <div className="container mx-auto px-4">
          <p className="text-center text-gray-500 text-sm mb-8 uppercase tracking-wider">
            INTEGRAÇÃO DIRETA COM BASES ATUALIZADAS
          </p>
          <div className="flex flex-wrap justify-center items-center gap-12 opacity-40 grayscale">
            <div className="h-12 w-32 bg-white/5 rounded flex items-center justify-center text-xs text-white/50">Google</div>
            <div className="h-12 w-32 bg-white/5 rounded flex items-center justify-center text-xs text-white/50">Microsoft</div>
            <div className="h-12 w-32 bg-white/5 rounded flex items-center justify-center text-xs text-white/50">Trello</div>
            <div className="h-12 w-32 bg-white/5 rounded flex items-center justify-center text-xs text-white/50">Slack</div>
          </div>
        </div>
      </section>

      {/* Problem → Solution Section */}
      <section className="py-24 bg-gradient-to-b from-black to-[#0a0a0a]">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                SUA OBRA NÃO ATRASA POR FALTA DE ESFORÇO.<br />
                ELA ATRASA POR FALTA DE <span className="text-[#FFA500]">VISIBILIDADE</span>.
              </h2>
              <p className="text-xl text-gray-400">
                E você sabe disso. Sem controle real, tudo vira improviso e adivinhação.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-12 items-start">
              {/* Problems */}
              <div className="space-y-4">
                <h3 className="text-2xl font-bold text-red-500 mb-6 flex items-center gap-2">
                  <X className="h-6 w-6" />
                  PROBLEMAS REAIS
                </h3>
                {[
                  { icon: AlertTriangle, text: "Planilhas desatualizadas e confusas" },
                  { icon: Clock, text: "Equipe perdida sem direcionamento" },
                  { icon: AlertTriangle, text: "Comunicação caótica no WhatsApp" },
                  { icon: Clock, text: "Falta de fotos e evidências" },
                  { icon: AlertTriangle, text: "Desperdício que não se rastreia" },
                  { icon: Clock, text: "RDO incompleto e atrasado" },
                  { icon: AlertTriangle, text: "Chamados que somem" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-4 rounded-lg bg-red-500/5 border border-red-500/20">
                    <item.icon className="h-5 w-5 text-red-500 mt-0.5" />
                    <span className="text-gray-300">{item.text}</span>
                  </div>
                ))}
              </div>

              {/* Solutions */}
              <div className="space-y-4">
                <h3 className="text-2xl font-bold text-[#FFA500] mb-6 flex items-center gap-2">
                  <Check className="h-6 w-6" />
                  BENEFÍCIOS CHAVE
                </h3>
                {[
                  { icon: TrendingUp, text: "Dashboard atualizado em tempo real", time: "INSTANTÂNEO" },
                  { icon: Shield, text: "Equipe alinhada com alertas automáticos", time: "24/7" },
                  { icon: FileCheck, text: "Registro centralizado com evidências", time: "RASTREÁVEL" },
                  { icon: Lock, text: "Fotos e vídeos organizados", time: "ACESSÍVEL" },
                  { icon: TrendingUp, text: "Controle de materiais em tempo real", time: "PRECISO" },
                  { icon: Shield, text: "RDO completo gerado automaticamente", time: "AUTOMÁTICO" },
                  { icon: FileCheck, text: "Chamados com QR Code rastreável", time: "INTELIGENTE" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-4 rounded-lg bg-[#FFA500]/5 border border-[#FFA500]/20">
                    <item.icon className="h-5 w-5 text-[#FFA500] mt-0.5" />
                    <div className="flex-1">
                      <span className="text-gray-300">{item.text}</span>
                      <div className="text-xs text-[#FFA500] font-mono mt-1">{item.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-center mt-16">
              <p className="text-2xl md:text-3xl font-bold text-[#FFA500]">
                OBRA SEM SISTEMA = ACHISMO.<br />
                <span className="text-white">E ACHISMO CUSTA CARO.</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 bg-[#0a0a0a]">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                COMO FUNCIONA O <span className="text-[#FFA500]">CONSTRUDATA</span>
              </h2>
              <p className="text-xl text-gray-400">
                Transparência total. Sem surpresas. Sem complicação.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  step: "01",
                  title: "Cadastre sua Obra",
                  desc: "Adicione projetos, equipes e materiais em minutos. Sistema intuitivo, sem curva de aprendizado."
                },
                {
                  step: "02",
                  title: "Registre em Tempo Real",
                  desc: "RDO automático, fotos com geolocalização, controle de materiais e alertas inteligentes."
                },
                {
                  step: "03",
                  title: "Acompanhe e Decida",
                  desc: "Dashboard completo com todas as informações. Tome decisões com dados reais, não suposições."
                }
              ].map((item, i) => (
                <div key={i} className="relative p-8 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all">
                  <div className="text-6xl font-bold text-[#FFA500]/20 mb-4">{item.step}</div>
                  <h3 className="text-2xl font-bold mb-4">{item.title}</h3>
                  <p className="text-gray-400">{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-16 p-8 rounded-xl border border-[#FFA500]/20 bg-[#FFA500]/5">
              <h3 className="text-2xl font-bold mb-4 text-[#FFA500]">O QUE ESTÁ INCLUSO:</h3>
              <ul className="grid md:grid-cols-2 gap-4 text-gray-300">
                <li className="flex items-center gap-2"><Check className="h-5 w-5 text-[#FFA500]" /> RDO Digital Completo</li>
                <li className="flex items-center gap-2"><Check className="h-5 w-5 text-[#FFA500]" /> Controle de Materiais</li>
                <li className="flex items-center gap-2"><Check className="h-5 w-5 text-[#FFA500]" /> Gestão de Equipes</li>
                <li className="flex items-center gap-2"><Check className="h-5 w-5 text-[#FFA500]" /> QR Code Manutenção</li>
                <li className="flex items-center gap-2"><Check className="h-5 w-5 text-[#FFA500]" /> Alertas Automáticos</li>
                <li className="flex items-center gap-2"><Check className="h-5 w-5 text-[#FFA500]" /> Dashboard 360°</li>
                <li className="flex items-center gap-2"><Check className="h-5 w-5 text-[#FFA500]" /> Fotos e Evidências</li>
                <li className="flex items-center gap-2"><Check className="h-5 w-5 text-[#FFA500]" /> Relatórios Automáticos</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Security & Guarantee */}
      <section className="py-24 bg-gradient-to-b from-[#0a0a0a] to-black border-t border-white/10">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 mb-6">
                <Shield className="w-5 h-5" />
                <span className="font-semibold">SEGURANÇA EMPRESARIAL</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                SEUS DADOS <span className="text-[#FFA500]">100% SEGUROS</span>
              </h2>
              <p className="text-xl text-gray-400">
                Infraestrutura de ponta com tecnologia de segurança bancária
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  icon: Lock,
                  title: "Criptografia",
                  desc: "Dados protegidos com criptografia de ponta a ponta"
                },
                {
                  icon: Shield,
                  title: "LGPD",
                  desc: "100% em conformidade com a Lei Geral de Proteção de Dados"
                },
                {
                  icon: Server,
                  title: "Backup",
                  desc: "Backup automático a cada hora. Seus dados nunca serão perdidos"
                },
                {
                  icon: FileCheck,
                  title: "Auditoria",
                  desc: "Log completo de todas as ações para rastreabilidade total"
                }
              ].map((item, i) => (
                <div key={i} className="p-6 rounded-xl border border-white/10 bg-white/5 hover:border-[#FFA500]/30 transition-all text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#FFA500]/10 mb-4">
                    <item.icon className="h-8 w-8 text-[#FFA500]" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                  <p className="text-sm text-gray-400">{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-16 text-center p-8 rounded-xl border border-green-500/20 bg-green-500/5">
              <h3 className="text-2xl font-bold mb-4 text-green-400">GARANTIA DE SATISFAÇÃO</h3>
              <p className="text-gray-300 text-lg">
                Teste o Construdata por 7 dias. Se não gostar, devolvemos 100% do seu investimento.<br />
                <span className="text-sm text-gray-500">Sem perguntas. Sem burocracia.</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 bg-gradient-to-br from-[#FFA500] via-[#FF8C00] to-[#FFA500] text-black">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <h2 className="text-5xl md:text-6xl font-bold">
              CHEGA DE OPERAR NO ESCURO.
            </h2>
            <p className="text-2xl font-medium">
              Controle sua obra e sua manutenção com profissionalismo.
            </p>
            <Button 
              size="lg" 
              className="bg-black text-white hover:bg-black/90 text-xl px-12 py-8 rounded-full font-bold shadow-2xl"
              onClick={() => navigate('/system-test')}
            >
              🔥 COMEÇAR AGORA
            </Button>
            <p className="text-black/70 text-sm">
              Demonstração instantânea • Sem compromisso • Cancele quando quiser
            </p>
          </div>
        </div>
      </section>

      <ContactDialog open={showContactDialog} onOpenChange={setShowContactDialog} />
    </div>
  );
};

export default Hero;
