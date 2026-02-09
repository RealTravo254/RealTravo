import { useNavigate } from "react-router-dom";
import { useCallback } from "react";

/**
 * Safe back navigation hook.
 * Falls back to the home page if there's no browser history.
 */
export const useSafeBack = (fallback = "/") => {
  const navigate = useNavigate();

  return useCallback(() => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(fallback, { replace: true });
    }
  }, [navigate, fallback]);
};
