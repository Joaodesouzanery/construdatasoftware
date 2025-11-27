import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Calendar, Mail } from "lucide-react";

interface ContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContactDialog({ open, onOpenChange }: ContactDialogProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-xl">Seja bem-vindo ao ConstruData!</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          <p className="text-muted-foreground">
            Vamos direto ao ponto. Você está aqui por um motivo — e eu consigo te ajudar mais rápido se você me disser qual é.
          </p>
          
          <div className="space-y-3">
            <p className="font-semibold">O que você precisa agora?</p>
            
            <Button
              className="w-full justify-start h-auto py-4 px-4"
              variant="outline"
              onClick={() => {
                window.open("https://calendar.app.google/your-calendar-link", "_blank");
              }}
            >
              <div className="flex items-start gap-3 text-left">
                <Calendar className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold">Agendar um atendimento</div>
                  <div className="text-sm text-muted-foreground">
                    Quero falar com alguém e resolver isso de uma vez.
                  </div>
                </div>
              </div>
            </Button>
            
            <Button
              className="w-full justify-start h-auto py-4 px-4"
              variant="outline"
              onClick={() => {
                window.location.href = "mailto:construdata.contato@gmail.com";
              }}
            >
              <div className="flex items-start gap-3 text-left">
                <Mail className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold">Falar com o suporte</div>
                  <div className="text-sm text-muted-foreground">
                    Tive um problema e quero solução sem enrolação.
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    construdata.contato@gmail.com
                  </div>
                </div>
              </div>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
