import { Link } from "react-router-dom";
import {
  Compass,
  Download,
  Facebook,
  Instagram,
  X,
  Mail,
  MessageSquare,
  Send as TikTok, // Renamed 'Send' to 'TikTok' for clarity in JSX
  Youtube,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

// Custom Tailwind Hover Color: #008080 (Dark Teal)
const TEAL_HOVER_CLASS = "hover:text-[#008080]";
// Custom Tailwind WhatsApp Color: #25D366
const WHATSAPP_COLOR_CLASS = "text-[#25D366]"; 
// Custom Tailwind TikTok Color: #000000 (Black)
const TIKTOK_COLOR_CLASS = "text-black";

// --- START: Define Social Media Links (Customize these URLs) ---
const socialLinks = {
  whatsapp: "https://wa.me/YOUR_WHATSAPP_NUMBER", // Replace with your WhatsApp number
  facebook: "https://facebook.com/YOUR_PAGE",
  instagram: "https://instagram.com/YOUR_ACCOUNT",
  tiktok: "https://tiktok.com/@YOUR_ACCOUNT",
  x: "https://x.com/YOUR_ACCOUNT", // Formerly Twitter
  youtube: "https://youtube.com/YOUR_CHANNEL", 
  email: "mailto:YOUR_EMAIL@example.com", // Replace with your email address
};
// --- END: Define Social Media Links ---

export const Footer = ({
  className = ""
}: {
  className?: string;
}) => {
  const [isInstalled, setIsInstalled] = useState(false);
  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }
  }, []);

  // Detect if running in webview/in-app context
  const isInApp = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('inApp') === 'true' || urlParams.get('forceHideBadge') === 'true' || /webview|wv|inapp/i.test(navigator.userAgent);
  };

  // Don't render footer on small screens when in-app
  if (typeof window !== 'undefined' && window.innerWidth < 768 && isInApp()) {
    return null;
  }
  
  return (
    <footer className={`hidden md:block bg-white border-t mt-1 text-gray-900 ${className}`}>
      <div className="container px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          
          {/* TripTrac Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {/* NOTE: Compass color changed to match new link hover color */}
              <Compass className="h-6 w-6 text-[#008080]" /> 
              <span className="font-bold text-lg">TripTrac</span>
              </div>
            <p className="text-sm text-gray-600"> 
              Discover amazing destinations and create unforgettable memories.
            </p>
          </div>
          
          {/* Quick Links */}
          <div>
            <h3 className="font-bold mb-3">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              {/* Link hover colors updated to custom teal */}
              <li><Link to="/" className={`text-gray-600 transition-colors ${TEAL_HOVER_CLASS}`}>Home</Link></li>
              <li><Link to="/become-host" className={`text-gray-600 transition-colors ${TEAL_HOVER_CLASS}`}>Become a Host</Link></li>
              <li><Link to="/about" className={`text-gray-600 transition-colors ${TEAL_HOVER_CLASS}`}>About</Link></li>
              <li><Link to="/contact" className={`text-gray-600 transition-colors ${TEAL_HOVER_CLASS}`}>Contact</Link></li>
            </ul>
          </div>
          
          {/* Categories */}
          <div>
            <h3 className="font-bold mb-3">Categories</h3>
            <ul className="space-y-2 text-sm">
              {/* Link hover colors updated to custom teal */}
              <li><Link to="/category/trips" className={`text-gray-600 transition-colors ${TEAL_HOVER_CLASS}`}>Trips</Link></li>
              <li><Link to="/category/events" className={`text-gray-600 transition-colors ${TEAL_HOVER_CLASS}`}>Events</Link></li>
              <li><Link to="/category/hotels" className={`text-gray-600 transition-colors ${TEAL_HOVER_CLASS}`}>Hotels</Link></li>
              <li><Link to="/category/adventure" className={`text-gray-600 transition-colors ${TEAL_HOVER_CLASS}`}>Adventure Place</Link></li>
            </ul>
          </div>
          
          {/* My Account */}
          <div>
            <h3 className="font-bold mb-3">My Account</h3>
            <ul className="space-y-2 text-sm">
              {/* Link hover colors updated to custom teal */}
              <li><Link to="/become-host" className={`text-gray-600 transition-colors ${TEAL_HOVER_CLASS}`}>Become a Host</Link></li>
              <li><Link to="/bookings" className={`text-gray-600 transition-colors ${TEAL_HOVER_CLASS}`}>My Bookings</Link></li>
              <li><Link to="/saved" className={`text-gray-600 transition-colors ${TEAL_HOVER_CLASS}`}>Wishlist</Link></li>
              <li><Link to="/profile" className={`text-gray-600 transition-colors ${TEAL_HOVER_CLASS}`}>Profile</Link></li>
            </ul>
            {!isInstalled && <Link to="/install">
              </Link>}
          </div>

          {/* Social Media and Email - UPDATED SECTION */}
          <div>
            <h3 className="font-bold mb-3">Connect With Us</h3>
            <div className="flex space-x-4 mb-4">
              
              {/* WhatsApp: Brand Color #25D366, Hover color is the same */}
              <a href={socialLinks.whatsapp} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
                <MessageSquare className={`h-6 w-6 ${WHATSAPP_COLOR_CLASS} hover:opacity-80 transition-opacity`} />
              </a>
              
              {/* Instagram: Brand Color (Pink/Purple gradient, approximating to pink-600) */}
              <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                <Instagram className="h-6 w-6 text-pink-600 hover:opacity-80 transition-opacity" />
              </a>

              {/* TikTok (Using 'Send' as a placeholder): Brand Color Black, Hover color is the same */}
              <a href={socialLinks.tiktok} target="_blank" rel="noopener noreferrer" aria-label="TikTok">
                <TikTok className={`h-6 w-6 ${TIKTOK_COLOR_CLASS} hover:opacity-80 transition-opacity`} />
              </a>
              
              {/* YouTube: Brand Color Red-600, Hover color is the same */}
              <a href={socialLinks.youtube} target="_blank" rel="noopener noreferrer" aria-label="YouTube">
                <Youtube className="h-6 w-6 text-red-600 hover:opacity-80 transition-opacity" />
              </a>

              {/* Facebook: Brand Color Blue-600, Hover color is the same */}
              <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                <Facebook className="h-6 w-6 text-blue-600 hover:opacity-80 transition-opacity" />
              </a>

              {/* X (Twitter): Brand Color Black, Hover color is the same */}
              <a href={socialLinks.x} target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)">
                <X className="h-6 w-6 text-black hover:opacity-80 transition-opacity" />
              </a>
            </div>
            
            {/* Email Link */}
            <div className="flex items-center space-x-2 text-sm">
              <Mail className="h-5 w-5 text-gray-600" />
              <a href={socialLinks.email} className={`text-gray-600 transition-colors ${TEAL_HOVER_CLASS}`}>
                Send us an email
              </a>
            </div>
          </div>
          
        </div>
        
        <div className="border-t border-gray-300 mt-8 pt-6 text-center text-sm text-gray-600">
          <div className="flex justify-center gap-6 mb-3">
            {/* Link hover colors updated to custom teal */}
            <Link to="/terms-of-service" className={`transition-colors ${TEAL_HOVER_CLASS}`}>
              Terms of Service
            </Link>
            <Link to="/privacy-policy" className={`transition-colors ${TEAL_HOVER_CLASS}`}>
              Privacy Policy
            </Link>
          </div>
          <p>© 2025 TripTrac. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};