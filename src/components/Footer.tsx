import { Link } from "react-router-dom";
import {
  Compass,
  Instagram,
  Mail,
  Linkedin,
  Info,
  Facebook
} from "lucide-react";

// Official Brand Colors
const BRAND_COLORS = {
  WHATSAPP: "#25D366",
  INSTAGRAM: "#E4405F",
  TIKTOK: "#000000",
  YOUTUBE: "#FF0000",
  FACEBOOK: "#1877F2",
  X: "#000000",
  LINKEDIN: "#0A66C2",
  PINTEREST: "#BD081C",
};

// --- Custom Brand-Accurate Icons ---

const WhatsAppIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.937 3.672 1.433 5.661 1.433h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const YouTubeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.377.505 9.377.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

const TikTokIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.06-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.59-1.01V14.5c.03 2.1-.47 4.31-1.89 5.88-1.53 1.77-3.92 2.64-6.2 2.37-2.58-.23-4.9-2-5.74-4.46-.91-2.47-.41-5.46 1.34-7.42 1.44-1.68 3.73-2.53 5.93-2.25V12.7c-1.01-.15-2.15.09-2.88.85-.75.84-.81 2.14-.31 3.09.47 1.05 1.64 1.75 2.79 1.6 1.18-.1 2.22-1.14 2.25-2.32V.02z" />
  </svg>
);

const XIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932 6.064-6.932zm-1.292 19.494h2.039L6.486 3.24H4.298l13.311 17.407z" />
  </svg>
);

const PinterestIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.289 2C6.617 2 2 6.617 2 12.289c0 4.305 2.605 7.977 6.34 9.542-.09-.806-.17-2.04.034-2.915.185-.79 1.197-5.076 1.197-5.076s-.306-.612-.306-1.515c0-1.42.823-2.48 1.848-2.48.87 0 1.29.654 1.29 1.44 0 .876-.558 2.185-.846 3.4-.24 1.013.51 1.84 1.508 1.84 1.81 0 3.204-1.907 3.204-4.662 0-2.438-1.753-4.144-4.256-4.144-2.898 0-4.6 2.174-4.6 4.42 0 .875.337 1.812.758 2.32.083.1.095.188.07.29-.077.322-.248.1.306-1.025.034-.145-.012-.27-.116-.395-1.036-1.246-1.28-2.316-1.28-3.75 0-3.056 2.22-5.862 6.4-5.862 3.36 0 5.97 2.395 5.97 5.594 0 3.34-2.105 6.03-5.024 6.03-.98 0-1.903-.51-2.217-1.11l-.604 2.3c-.218.84-.81 1.89-1.206 2.53 1.1.34 2.27.52 3.48.52 5.67 0 10.29-4.62 10.29-10.29C22.58 6.617 17.96 2 12.289 2z" />
  </svg>
);

export const Footer = ({ className = "" }: { className?: string }) => {
  return (
    <footer className={`hidden md:block bg-slate-50 border-t mt-16 text-slate-900 ${className}`}>
      <div className="container px-6 py-12 mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-12">
          
          {/* Brand Info */}
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <div className="bg-[#008080] p-2 rounded-xl">
                <Compass className="h-6 w-6 text-white" />
              </div>
              <span className="font-black text-2xl tracking-tighter italic">RealTravo</span>
            </div>
            <p className="text-sm leading-relaxed text-slate-500">
              Your gateway to authentic experiences. Explore, book, and share your journey with the world.
            </p>
          </div>
          
          {/* Links Columns */}
          <div className="flex flex-col gap-4">
            <h3 className="font-bold text-slate-900">Explore</h3>
            <ul className="space-y-3 text-sm font-medium">
              <li><Link to="/" className="text-slate-500 hover:text-[#008080] transition-colors">Destinations</Link></li>
              <li><Link to="/category/events" className="text-slate-500 hover:text-[#008080] transition-colors">Local Events</Link></li>
              <li><Link to="/category/hotels" className="text-slate-500 hover:text-[#008080] transition-colors">Hotels</Link></li>
            </ul>
          </div>

          <div className="flex flex-col gap-4">
            <h3 className="font-bold text-slate-900">Support</h3>
            <ul className="space-y-3 text-sm font-medium">
              <li><Link to="/about" className="text-slate-500 hover:text-[#008080] transition-colors">About Us</Link></li>
              <li><Link to="/contact" className="text-slate-500 hover:text-[#008080] transition-colors">Contact</Link></li>
              <li><Link to="/become-host" className="text-slate-500 hover:text-[#008080] transition-colors">Become a Host</Link></li>
            </ul>
          </div>

          <div className="flex flex-col gap-4">
            <h3 className="font-bold text-slate-900">Legal</h3>
            <ul className="space-y-3 text-sm font-medium">
              <li><Link to="/privacy-policy" className="text-slate-500 hover:text-[#008080] transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms-of-service" className="text-slate-500 hover:text-[#008080] transition-colors">Terms of Service</Link></li>
            </ul>
          </div>

          {/* Social Media Grid */}
          <div className="flex flex-col gap-4">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-[0.1em]">Follow Our Journey</h3>
            <div className="grid grid-cols-4 gap-2">
              <SocialIcon href="https://wa.me/0758800117" color={BRAND_COLORS.WHATSAPP} icon={<WhatsAppIcon />} />
              <SocialIcon href="https://www.instagram.com/realtravo_/" color={BRAND_COLORS.INSTAGRAM} icon={<Instagram className="h-5 w-5" />} />
              <SocialIcon href="https://www.tiktok.com/@real_travo" color={BRAND_COLORS.TIKTOK} icon={<TikTokIcon />} />
              <SocialIcon href="https://youtube.com/@realtravo" color={BRAND_COLORS.YOUTUBE} icon={<YouTubeIcon />} />
              <SocialIcon href="https://www.facebook.com/profile.php?id=61588626561026" color={BRAND_COLORS.FACEBOOK} icon={<Facebook className="h-5 w-5 fill-current" />} />
              <SocialIcon href="https://www.linkedin.com/in/real-travo-aa62b63b2/" color={BRAND_COLORS.LINKEDIN} icon={<Linkedin className="h-5 w-5 fill-current" />} />
              <SocialIcon href="https://www.pinterest.com/RealTravo01/" color={BRAND_COLORS.PINTEREST} icon={<PinterestIcon />} />
              <SocialIcon href="https://x.com/RealTravo" color={BRAND_COLORS.X} icon={<XIcon />} />
            </div>
            
            <a href="mailto:support@realtravo.com" className="mt-2 flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-[#008080] transition-all">
              <Mail className="h-4 w-4" />
              <span>SUPPORT@REALTRAVO.COM</span>
            </a>
          </div>
        </div>

        {/* Affiliate Disclosure */}
        <div className="mt-12 bg-white border border-slate-200 rounded-2xl p-5 flex items-start gap-4 shadow-sm">
          <Info className="h-5 w-5 text-teal-600 shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed text-slate-500">
            <strong>Transparency:</strong> RealTravo may earn a commission for some accommodation bookings. This commission is paid by the property and <strong>is never added to your final booking cost</strong>. This allows us to keep our platform free for travelers.
          </p>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-slate-200 mt-10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
          <p>© 2026 RealTravo. All rights reserved.</p>
          <div className="flex gap-4 items-center">
            <span className="h-1 w-1 rounded-full bg-slate-300"></span>
            <p>Made for Modern Travelers</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

const SocialIcon = ({ color, icon, href = "#" }: { color: string, icon: React.ReactNode, href?: string }) => (
  <a 
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center justify-center h-10 w-10 rounded-xl bg-white border border-slate-100 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1"
    style={{ color: color }}
  >
    {icon}
  </a>
);