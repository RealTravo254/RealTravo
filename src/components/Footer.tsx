import { Link } from "react-router-dom";
import { Compass } from "lucide-react";

export const Footer = () => {
  return (
    // Changed background color class to bg-blue-900 (Deep Navy)
    <footer className="bg-blue-900 border-t mt-12 text-white"> 
      <div className="container px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Compass className="h-6 w-6 text-white" /> {/* Icon color remains white */}
              <span className="font-bold text-lg">TripTrac</span>
            </div>
            {/* Adjusted text color to text-blue-200 for better contrast on dark blue */}
            <p className="text-sm text-blue-200"> 
              Discover amazing destinations and create unforgettable memories.
            </p>
          </div>
          
          <div>
            <h3 className="font-bold mb-3">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/" className="text-blue-200 hover:text-white transition-colors">Home</Link></li>
              <li><Link to="/CreateHotel" className="text-blue-200 hover:text-white transition-colors">List Hotel</Link></li>
              <li><Link to="/CreateAdventure" className="text-blue-200 hover:text-white transition-colors">List Your Campsite</Link></li>
              <li><Link to="/CreateTripEvent" className="text-blue-200 hover:text-white transition-colors">Organise Trip</Link></li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-bold mb-3">Categories</h3>
            <ul className="space-y-2 text-sm">
              {/* Links use text-blue-200 with hover:text-white */}
              <li><Link to="/category/trips" className="text-blue-200 hover:text-white transition-colors">Trips</Link></li>
              <li><Link to="/category/events" className="text-blue-200 hover:text-white transition-colors">Events</Link></li>
              <li><Link to="/category/hotels" className="text-blue-200 hover:text-white transition-colors">Hotels</Link></li>
              <li><Link to="/category/adventure" className="text-blue-200 hover:text-white transition-colors">Adventure</Link></li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-bold mb-3">My Account</h3>
            <ul className="space-y-2 text-sm">
              {/* Links use text-blue-200 with hover:text-white */}
              <li><Link to="/bookings" className="text-blue-200 hover:text-white transition-colors">My Bookings</Link></li>
              <li><Link to="/saved" className="text-blue-200 hover:text-white transition-colors">Saved</Link></li>
              <li><Link to="/vlog" className="text-blue-200 hover:text-white transition-colors">Vlog</Link></li>
            </ul>
          </div>
        </div>
        
        {/* Border changed to border-blue-600 and text color to text-blue-200 */}
        <div className="border-t border-blue-600 mt-8 pt-6 text-center text-sm text-blue-200">
          <p>© 2025 TripTrac. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};