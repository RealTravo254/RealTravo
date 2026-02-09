import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const MyReferrals = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    // Referral data is shown on the Payment page
    navigate("/payment", { replace: true });
  }, [navigate]);

  return null;
};

export default MyReferrals;
