import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Footer } from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Mail, Phone, MapPin } from "lucide-react";
import { SEOHead } from "@/components/SEOHead";

const Contact = () => {
  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <SEOHead title="Contact Realtravo | Get in Touch" description="Have questions? Contact the Realtravo team for support with bookings, hosting, and travel experiences." canonical="https://realtravo.com/contact" />
      <Header />
      
      <main className="container px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Contact Us</h1>
        
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl">
          <Card className="p-6 text-center">
            <Mail className="h-12 w-12 mx-auto mb-4 text-primary" />
            <h3 className="font-bold mb-2">Email</h3>
            <p className="text-muted-foreground">support@realtravo.com</p>
          </Card>
          
          <Card className="p-6 text-center">
            <Phone className="h-12 w-12 mx-auto mb-4 text-primary" />
            <h3 className="font-bold mb-2">Phone</h3>
            <p className="text-muted-foreground">+254758800117</p>
          </Card>
          
          <Card className="p-6 text-center">
            <MapPin className="h-12 w-12 mx-auto mb-4 text-primary" />
            <h3 className="font-bold mb-2">Address</h3>
            <p className="text-muted-foreground"> Travel St,  Nairobi City</p>
          </Card>
        </div>
      </main>

      <Footer />
      <MobileBottomBar />
    </div>
  );
};

export default Contact;
