import { useNavigate } from "react-router-dom";
import { useSafeBack } from "@/hooks/useSafeBack";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { useBanCheck } from "@/hooks/useBanCheck";
import { ArrowLeft, Hotel, Home, ChevronRight, CheckCircle2 } from "lucide-react";

/**
 * Shown when someone chooses to host accommodation. They pick what they are
 * listing, then continue to the matching form:
 *   Hotel  → /create-hotel   (several room types, TRA licence)
 *   Airbnb → /create-airbnb  (one whole property, no room types)
 *
 * Routes to register:
 *   <Route path="/choose-accommodation" element={<ChooseAccommodationType />} />
 *   <Route path="/create-hotel"  element={<CreateHotel />} />
 *   <Route path="/create-airbnb" element={<CreateAirbnb />} />
 *
 * On the become-host page, point the accommodation / hotel option to
 * "/choose-accommodation" instead of "/create-hotel".
 */

const COLORS = { TEAL: "#008080", CORAL: "#FF7F50" };

const OPTIONS = [
  {
    key: "hotel",
    title: "Hotel",
    icon: Hotel,
    path: "/create-hotel",
    blurb: "A registered hotel with several room types, each with its own price and photos.",
    points: ["Multiple room types", "Star rating & check-in times", "Business registration + TRA licence"],
  },
  {
    key: "airbnb",
    title: "Airbnb / BnB",
    icon: Home,
    path: "/create-airbnb",
    blurb: "A single place guests book as a whole — apartment, house, villa, cabin or private room.",
    points: ["One property, one nightly price", "Guests, bedrooms, beds & bathrooms", "Company or individual host"],
  },
];

const ChooseAccommodationType = () => {
  const navigate = useNavigate();
  const goBack = useSafeBack("/become-host");
  useBanCheck();

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <Header />

      <main className="max-w-3xl mx-auto px-4 lg:px-8 py-8 lg:py-12">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={goBack} aria-label="Go back" className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-all shadow-sm">
            <ArrowLeft className="h-4 w-4 text-slate-600" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">What are you hosting?</h1>
            <p className="text-sm text-slate-400 font-medium mt-0.5">Choose the type of accommodation to list</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => navigate(opt.path)}
              className="group text-left bg-white rounded-2xl border border-slate-100 shadow-sm p-6 hover:shadow-md hover:border-[#008080]/40 transition-all active:scale-[0.99]"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                style={{ background: `linear-gradient(135deg, ${COLORS.TEAL}, #005f5f)` }}
              >
                <opt.icon className="h-6 w-6 text-white" />
              </div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">{opt.title}</h2>
              <p className="text-xs text-slate-500 leading-relaxed mt-1 mb-4">{opt.blurb}</p>
              <ul className="space-y-1.5 mb-5">
                {opt.points.map((p) => (
                  <li key={p} className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: COLORS.TEAL }} />
                    {p}
                  </li>
                ))}
              </ul>
              <span className="inline-flex items-center gap-1 text-[12px] font-bold" style={{ color: COLORS.CORAL }}>
                Continue as {opt.title} <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>
          ))}
        </div>
      </main>

      <MobileBottomBar />
    </div>
  );
};

export default ChooseAccommodationType;