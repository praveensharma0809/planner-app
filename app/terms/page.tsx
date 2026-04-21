import Link from "next/link";
import { Plus_Jakarta_Sans } from "next/font/google";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export default function TermsPage() {
  return (
    <div className={`${plusJakarta.className} min-h-screen bg-[#F5F3FF] text-[#0B0C1A] py-20 px-6`}>
      <div className="max-w-3xl mx-auto bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-black/[0.06]">
        <Link href="/landingpage" className="inline-flex items-center text-sm font-bold text-[#4F46E5] hover:text-[#4338CA] mb-8">
          &larr; Back to Home
        </Link>
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-8">Terms of Service</h1>
        <div className="space-y-6 text-[#454772] leading-relaxed">
          <p>Last updated: {new Date().toLocaleDateString()}</p>
          <p>
            Welcome to PrepVeda! By using our website and services, you agree to comply with and be bound by the following terms and conditions of use.
          </p>
          <h2 className="text-xl font-bold text-[#0B0C1A]">1. Use of the Service</h2>
          <p>
            You agree to use PrepVeda solely for your personal educational planning purposes. You may not use the service for any illegal or unauthorized purpose.
          </p>
          <h2 className="text-xl font-bold text-[#0B0C1A]">2. Accounts</h2>
          <p>
            When you create an account with us, you must provide accurate, complete, and current information at all times. Failure to do so constitutes a breach of the Terms.
          </p>
          <h2 className="text-xl font-bold text-[#0B0C1A]">3. Changes to Terms</h2>
          <p>
            We reserve the right, at our sole discretion, to modify or replace these Terms at any time. What constitutes a material change will be determined at our sole discretion.
          </p>
          <h2 className="text-xl font-bold text-[#0B0C1A]">Contact Us</h2>
          <p>
            If you have any questions about these Terms, please contact us at{" "}
            <a href="mailto:stayyplanned@gmail.com" className="text-[#4F46E5] hover:underline">
              stayyplanned@gmail.com
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
