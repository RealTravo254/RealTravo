import { Home, Video, Phone, Info, Plane, Building, Tent, Ticket, Heart, Package, Edit, LogOut } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

export const DesktopSidebar = () => {
  const { user, signOut } = useAuth();

  const handleProtectedNavigation = (path: string) => {
    if (!user) {
      window.location.href = "/auth";
    } else {
      window.location.href = path;
    }
  };

  const partnerItems = [
    { icon: Plane, label: "Create Trip", path: "/CreateTripEvent" },
    { icon: Building, label: "List Hotel", path: "/CreateHotel" },
    { icon: Tent, label: "List Your Campsite", path: "/CreateAdventure" },
  ];

  const navItems = [
    { icon: Home, label: "Home", path: "/" },
    { icon: Video, label: "Vlog", path: "/vlog" },
    { icon: Phone, label: "Contact", path: "/contact" },
    { icon: Info, label: "About", path: "/about" },
  ];

  const myContentItems = [
    { icon: Ticket, label: "My Bookings", path: "/bookings" },
    { icon: Heart, label: "Saved", path: "/saved" },
    { icon: Package, label: "My Content", path: "/mycontent" },
  ];

  return (
    <aside className="hidden lg:flex lg:flex-col fixed left-0 top-0 h-screen w-72 bg-blue-950 border-r border-blue-800 z-50">
      {/* Header section */}
      <div className="p-6 border-b border-blue-800 bg-blue-900">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-white flex items-center justify-center text-blue-900 font-bold text-xl">
            T
          </div>
          <div>
            <h2 className="font-bold text-lg text-white">TripTrac</h2>
            <p className="text-xs text-blue-200">Explore the world</p>
          </div>
        </div>
      </div>

      {/* Navigation content */}
      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-2">
          {/* Partner Links */}
          <li className="mb-4 pt-2 border-t border-blue-800">
            <ul className="space-y-1">
              {partnerItems.map((item) => (
                <li key={item.path}>
                  <button
                    onClick={() => handleProtectedNavigation(item.path)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-white/10 transition-all duration-200 group"
                  >
                    <item.icon className="h-5 w-5 text-white" />
                    <span className="font-medium text-white">{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </li>

          {/* My Content Links */}
          <li className="mb-4 border-t border-blue-800 pt-2">
            <p className="px-4 py-2 text-xs font-semibold text-blue-200 uppercase">My Content</p>
            <ul className="space-y-1">
              {myContentItems.map((item) => (
                <li key={item.path}>
                  <button
                    onClick={() => handleProtectedNavigation(item.path)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-white/10 transition-all duration-200 group"
                  >
                    <item.icon className="h-5 w-5 text-white" />
                    <span className="font-medium text-white">{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </li>

          {/* Edit Profile Link */}
          {user && (
            <li>
              <Link
                to="/profile/edit"
                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-all duration-200 group"
              >
                <Edit className="h-5 w-5 text-white" />
                <span className="font-medium text-white">Edit Profile</span>
              </Link>
            </li>
          )}

          {/* Main Navigation */}
          {navItems.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-all duration-200 group"
              >
                <item.icon className="h-5 w-5 text-white" />
                <span className="font-medium text-white">{item.label}</span>
              </Link>
            </li>
          ))}

          {/* Logout Button */}
          {user ? (
            <li className="mt-4">
              <Button
                onClick={signOut}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-all duration-200"
              >
                <LogOut className="h-5 w-5" />
                <span className="font-medium">Logout</span>
              </Button>
            </li>
          ) : null}
        </ul>
      </nav>
    </aside>
  );
};
