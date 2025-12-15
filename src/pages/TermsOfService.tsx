import { PageLayout } from "@/components/PageLayout";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const TermsOfService = () => {
  const navigate = useNavigate();

  return (
    <PageLayout>
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>
        
        <div className="prose prose-sm max-w-none space-y-6">
          <p className="text-muted-foreground">Last updated: December 2024</p>

          <section>
            <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground">
              By accessing and using TripTrac, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by these terms, please do not use this service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Use of Service</h2>
            <p className="text-muted-foreground">
              TripTrac provides a platform for users to discover and book travel experiences, accommodations, and events. You agree to use our services only for lawful purposes and in accordance with these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. User Accounts</h2>
            <p className="text-muted-foreground">
              When you create an account with us, you must provide accurate, complete, and current information. You are responsible for safeguarding your account password and for any activities or actions under your account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Bookings and Payments</h2>
            <p className="text-muted-foreground">
              All bookings are subject to availability and confirmation. Payment processing is handled through secure third-party payment providers. Cancellation and refund policies vary by listing and are specified at the time of booking.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Host Responsibilities</h2>
            <p className="text-muted-foreground">
              Hosts are responsible for ensuring their listings are accurate, compliant with local laws, and meet our quality standards. Hosts must provide the services as described in their listings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Prohibited Activities</h2>
            <p className="text-muted-foreground">
              Users are prohibited from: posting false or misleading information, engaging in fraudulent activities, violating any applicable laws, harassing other users, or attempting to circumvent our platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Intellectual Property</h2>
            <p className="text-muted-foreground">
              All content on TripTrac, including text, graphics, logos, and software, is the property of TripTrac or its content suppliers and is protected by intellectual property laws.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Limitation of Liability</h2>
            <p className="text-muted-foreground">
              TripTrac shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Changes to Terms</h2>
            <p className="text-muted-foreground">
              We reserve the right to modify these terms at any time. We will notify users of any material changes via email or through the platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Contact Us</h2>
            <p className="text-muted-foreground">
              If you have any questions about these Terms, please contact us through the Contact page on our platform.
            </p>
          </section>
        </div>
      </div>
    </PageLayout>
  );
};

export default TermsOfService;
