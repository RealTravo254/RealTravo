import { Link } from "react-router-dom";
import { Compass } from "lucide-react";

export const Footer = () => {
  // Detect if running in webview/in-app context
  const isInApp = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('inApp') === 'true' || 
           urlParams.get('forceHideBadge') === 'true' ||
           /webview|wv|inapp/i.test(navigator.userAgent);
  };

  // Don't render footer on small screens when in-app
  if (typeof window !== 'undefined' && window.innerWidth < 768 && isInApp()) {
    return null;
  }

  return (
    <footer className="hidden md:block bg-white border-t mt-12 text-gray-900">
      <div className="container px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Compass className="h-6 w-6 text-blue-600" />
              <span className="font-bold text-lg">TripTrac</span>
            </div>
            <p className="text-sm text-gray-600"> 
              Discover amazing destinations and create unforgettable memories.
            </p>
          </div>
          
          <div>
            <h3 className="font-bold mb-3">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/" className="text-gray-600 hover:text-blue-600 transition-colors">Home</Link></li>
              <li><Link to="/become-host" className="text-gray-600 hover:text-blue-600 transition-colors">Become a Host</Link></li>
              <li><Link to="/about" className="text-gray-600 hover:text-blue-600 transition-colors">About</Link></li>
              <li><Link to="/contact" className="text-gray-600 hover:text-blue-600 transition-colors">Contact</Link></li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-bold mb-3">Categories</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/category/trips" className="text-gray-600 hover:text-blue-600 transition-colors">Trips</Link></li>
              <li><Link to="/category/events" className="text-gray-600 hover:text-blue-600 transition-colors">Events</Link></li>
              <li><Link to="/category/hotels" className="text-gray-600 hover:text-blue-600 transition-colors">Hotels</Link></li>
              <li><Link to="/category/adventure" className="text-gray-600 hover:text-blue-600 transition-colors">Adventure</Link></li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-bold mb-3">My Account</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/become-host" className="text-gray-600 hover:text-blue-600 transition-colors">Become a Host</Link></li>
              <li><Link to="/bookings" className="text-gray-600 hover:text-blue-600 transition-colors">My Bookings</Link></li>
              <li><Link to="/saved" className="text-gray-600 hover:text-blue-600 transition-colors">Wishlist</Link></li>
              <li><Link to="/profile" className="text-gray-600 hover:text-blue-600 transition-colors">Profile</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-gray-300 mt-8 pt-6 text-center text-sm text-gray-600">
          <p>© 2025 TripTrac. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};