import { ReactNode } from "react";
import { useLocation, Navigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";

const ALLOWED_PATHS = ["/meu-ponto", "/auth"];

interface RestrictedEmployeeGateProps {
  children: ReactNode;
}

// Primeiro guard de rota por papel deste sistema: impede que uma conta
// restrita de funcionário (Ponto Eletrônico) acesse qualquer página além de
// /meu-ponto. A autorização real dos dados continua sendo feita pela RLS do
// banco (is_own_funcionario/owns_funcionario) - este componente só evita que
// a página administrativa chegue a montar para quem não deveria vê-la.
export const RestrictedEmployeeGate = ({ children }: RestrictedEmployeeGateProps) => {
  const { isRestrictedEmployee, loading } = useUserRole();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isRestrictedEmployee && !ALLOWED_PATHS.includes(location.pathname)) {
    return <Navigate to="/meu-ponto" replace />;
  }

  return <>{children}</>;
};
