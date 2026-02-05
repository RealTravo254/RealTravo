import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";

import { Card } from "@/components/ui/card";

const About = () => {
  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Header />
    
      <main className="container px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">About TripTrac</h1>
        
        <Card className="p-8 max-w-3xl">
          <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Your Gateway to Adventure
          </h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              TripTrac is your ultimate companion for discovering and booking amazing travel experiences around the world. 
              We connect adventurous souls with unforgettable trips, events, accommodations, and destinations.
            </p>
            <p>
              Whether you're seeking thrilling adventures, cultural events, luxury hotels, or hidden gems, 
              our platform makes it easy to explore, save, and book your perfect getaway.
            </p>
            <p className="font-semibold text-foreground">
              Start exploring today and create memories that last a lifetime!
            </p>
          </div>
        </Card>
      </main>

      
      <MobileBottomBar />
    </div>
  );
};

export default About;