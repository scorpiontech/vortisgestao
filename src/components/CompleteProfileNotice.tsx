import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const STORAGE_KEY = "vortis:doc_notice_dismissed";

/** Avisa o responsável da empresa quando o cadastro está sem CPF/CNPJ. */
export function CompleteProfileNotice() {
  const { user } = useAuth();
  const { effectiveUserId, isMaster, isGerente, loading } = useUserRole();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loading || !user || !effectiveUserId) return;
    if (!isMaster && !isGerente) return;
    if (sessionStorage.getItem(STORAGE_KEY) === user.id) return;

    let active = true;
    (async () => {
      const { data } = await supabase
        .from("company_registrations")
        .select("document")
        .eq("user_id", effectiveUserId);

      const hasDoc = (data || []).some(r => (r.document || "").replace(/\D/g, "").length >= 11);
      if (active && !hasDoc) setOpen(true);
    })();

    return () => { active = false; };
  }, [user, effectiveUserId, isMaster, isGerente, loading]);

  const dismiss = () => {
    if (user) sessionStorage.setItem(STORAGE_KEY, user.id);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) dismiss(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Cadastro incompleto
          </DialogTitle>
          <DialogDescription>
            Sua empresa ainda está sem CPF/CNPJ registrado. Esse dado é necessário para
            emissão de notas fiscais, cobranças e faturas. Leva menos de um minuto.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={dismiss}>Depois</Button>
          <Button onClick={() => { dismiss(); navigate("/cadastro"); }}>Completar cadastro</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
