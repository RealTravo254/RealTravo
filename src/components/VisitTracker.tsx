import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { startVisitTracking, trackPageChange } from "@/lib/visitTracker";

export default function VisitTracker() {
  const location = useLocation();

  useEffect(() => {
    startVisitTracking(() => window.location.pathname);
  }, []);

  useEffect(() => {
    trackPageChange();
  }, [location.pathname]);

  return null;
}