import { CreditCard, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaymentMethodSelectorProps {
  paymentMethod: 'mpesa' | 'card';
  onMethodChange: (method: 'mpesa' | 'card') => void;
  primaryColor?: string;
  disabled?: boolean;
}

export const PaymentMethodSelector = ({
  paymentMethod,
  onMethodChange,
  primaryColor = "#008080",
  disabled = false,
}: PaymentMethodSelectorProps) => {
  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        type="button"
        onClick={() => onMethodChange('mpesa')}
        disabled={disabled}
        className={cn(
          "p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2",
          paymentMethod === 'mpesa' 
            ? "border-current shadow-lg" 
            : "border-slate-200 hover:border-slate-300",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        style={paymentMethod === 'mpesa' ? { borderColor: primaryColor, color: primaryColor } : {}}
      >
        <div 
          className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center",
            paymentMethod === 'mpesa' ? "bg-current/10" : "bg-slate-100"
          )}
          style={paymentMethod === 'mpesa' ? { backgroundColor: `${primaryColor}15` } : {}}
        >
          <Phone 
            className="h-6 w-6" 
            style={{ color: paymentMethod === 'mpesa' ? primaryColor : '#64748b' }}
          />
        </div>
        <div className="text-center">
          <p className="text-sm font-black uppercase tracking-tight">M-Pesa</p>
          <p className="text-[10px] text-slate-500">Pay via STK Push</p>
        </div>
      </button>

      <button
        type="button"
        onClick={() => onMethodChange('card')}
        disabled={disabled}
        className={cn(
          "p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2",
          paymentMethod === 'card' 
            ? "border-current shadow-lg" 
            : "border-slate-200 hover:border-slate-300",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        style={paymentMethod === 'card' ? { borderColor: primaryColor, color: primaryColor } : {}}
      >
        <div 
          className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center",
            paymentMethod === 'card' ? "bg-current/10" : "bg-slate-100"
          )}
          style={paymentMethod === 'card' ? { backgroundColor: `${primaryColor}15` } : {}}
        >
          <CreditCard 
            className="h-6 w-6" 
            style={{ color: paymentMethod === 'card' ? primaryColor : '#64748b' }}
          />
        </div>
        <div className="text-center">
          <p className="text-sm font-black uppercase tracking-tight">Card</p>
          <p className="text-[10px] text-slate-500">Debit/Credit Card</p>
        </div>
      </button>
    </div>
  );
};
