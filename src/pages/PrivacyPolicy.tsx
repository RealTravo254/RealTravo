import { PageLayout } from "@/components/PageLayout";
import { ArrowLeft, ShieldCheck, Lock, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <PageLayout>
      <div className="container max-w-3xl mx-auto px-6 py-12">
        {/* Back Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="mb-8 hover:bg-muted text-muted-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        {/* Header Section */}
        <div className="border-b border-border pb-6 mb-8">
          <h1 className="text-4xl font-extrabold tracking-tight mb-2 text-foreground">
            Privacy Policy
          </h1>
          <p className="text-sm text-muted-foreground">Last updated: July 2026</p>
        </div>

        {/* Policy Content */}
        <div className="space-y-8 text-foreground/90 leading-relaxed">
          
          {/* Important Highlight Box */}
          <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg border border-border">
            <ShieldCheck className="h-6 w-6 text-primary shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              Your trust is our highest priority. We explicitly limit the data we collect to only what is necessary to run our service, and <strong>we never sell or share your data with third parties</strong>.
            </p>
          </div>

          {/* Section 1 */}
          <section>
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2 text-foreground">
              <span className="text-xs bg-muted border text-muted-foreground px-2 py-0.5 rounded">1</span>
              Information We Collect
            </h2>
            <p className="text-muted-foreground pl-7">
              We only collect the specific information you provide directly to us in order to use our services. This includes: your name, email address, phone number, and bank details for payment processing only. Additionally, we collect Tourism Regulatory Authority (TRA) licenses from our providers to ensure and verify regulation by the official tourism regulatory board.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2 text-foreground">
              <span className="text-xs bg-muted border text-muted-foreground px-2 py-0.5 rounded">2</span>
              How We Use Your Information
            </h2>
            <p className="text-muted-foreground pl-7">
              The information we collect is used strictly to: verify your platform credentials (such as your TRA regulatory status), process secure financial transactions, maintain your account, and provide customer support when you request assistance.
            </p>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2 text-foreground">
              <span className="text-xs bg-muted border text-muted-foreground px-2 py-0.5 rounded">3</span>
              Data Sharing Policy
            </h2>
            <div className="flex items-start gap-3 pl-7 text-muted-foreground">
              <EyeOff className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <p>
                <strong>We do not share your data with anyone else.</strong> Your personal information, banking details, and TRA license documentation are strictly private and are never sold, rented, or distributed to third-party companies, marketing firms, or any outside entities.
              </p>
            </div>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2 text-foreground">
              <span className="text-xs bg-muted border text-muted-foreground px-2 py-0.5 rounded">4</span>
              Data Security
            </h2>
            <div className="flex items-start gap-3 pl-7 text-muted-foreground">
              <Lock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <p>
                We implement industry-standard security measures and encryption protocols to protect your banking details, regulatory licenses, and contact information against unauthorized access, alteration, or disclosure.
              </p>
            </div>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2 text-foreground">
              <span className="text-xs bg-muted border text-muted-foreground px-2 py-0.5 rounded">5</span>
              Your Rights & Control
            </h2>
            <p className="text-muted-foreground pl-7">
              You retain full rights over your data. You may contact us at any time to review, update, correct, or request the permanent deletion of your personal details, financial logs, or TRA license records from our system.
            </p>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2 text-foreground">
              <span className="text-xs bg-muted border text-muted-foreground px-2 py-0.5 rounded">6</span>
              Changes to This Policy
            </h2>
            <p className="text-muted-foreground pl-7">
              We may occasionally update this policy to reflect minor administrative changes. If changes occur, we will adjust the "Last updated" date at the top of this page.
            </p>
          </section>

          {/* Contact Section */}
          <section className="pt-6 border-t border-border">
            <h2 className="text-xl font-semibold mb-3 text-foreground">Contact Us</h2>
            <p className="text-muted-foreground">
              If you have any questions about how securely your data is managed or need assistance with your information, please get in touch with our team directly through the Contact page on our platform.
            </p>
          </section>
          
        </div>
      </div>
    </PageLayout>
  );
};

export default PrivacyPolicy;