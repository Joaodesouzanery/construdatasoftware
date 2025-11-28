import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export type UserRole = 'admin' | 'user' | null;

export const useUserRole = () => {
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkUserRole();
  }, []);

  const checkUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setRole(null);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (error) {
        console.error("Error checking user role:", error);
        setRole(null);
        setIsAdmin(false);
      } else if (data) {
        setRole(data.role as UserRole);
        setIsAdmin(data.role === 'admin');
      }
    } catch (error) {
      console.error("Error in role check:", error);
      setRole(null);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  const canDelete = () => isAdmin;
  
  const canEdit = () => true; // Both admin and user can edit, but user edits are logged
  
  const requiresApproval = (action: 'delete' | 'edit') => {
    return !isAdmin && action === 'delete';
  };

  return { 
    role, 
    loading, 
    isAdmin,
    canDelete,
    canEdit,
    requiresApproval,
    refetch: checkUserRole 
  };
};
