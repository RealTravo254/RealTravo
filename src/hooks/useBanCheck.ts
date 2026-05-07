import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

/**
 * Redirects banned users away from create/host pages.
 */
export const useBanCheck = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("is_banned")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.is_banned) {
          toast({
            title: "Account Banned",
            description: "You cannot create or host listings on this platform.",
            variant: "destructive",
          });
          navigate("/");
        }
      });
    return () => { cancelled = true; };
  }, [user, navigate, toast]);
};
