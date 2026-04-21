import Link from "next/link";
import { Plus_Jakarta_Sans } from "next/font/google";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export default function PrivacyPage() {
  return (
    <div className={`${plusJakarta.className} min-h-screen bg-[#F5F3FF] text-[#0B0C1A] py-20 px-6`}>
      <div className="max-w-3xl mx-auto bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-black/[0.06]">
        <Link href="/landingpage" className="inline-flex items-center text-sm font-bold text-[#4F46E5] hover:text-[#4338CA] mb-8">
          &larr; Back to Home
        </Link>
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-8">Privacy Policy</h1>
        <div className="space-y-6 text-[#454772] leading-relaxed">
          <p>Last updated: {new Date().toLocaleDateString()}</p>
          <p>
            At PrepVeda, your privacy is our priority. We collect only the data necessary to provide our exam scheduling and tracking services. This includes your syllabus inputs, study constraints, and progress data.
          </p>
          <h2 className="text-xl font-bold text-[#0B0C1A]">Information Collection</h2>
          <p>
            We collect information you provide directly to us when you create an account, input study materials, or communicate with us.
          </p>
          <h2 className="text-xl font-bold text-[#0B0C1A]">Use of Information</h2>
          <p>
            We use the information we collect to generate your study plans, provide feasibility analytics, and improve the core application algorithms. We do not sell your personal data to third parties.
          </p>
          <h2 className="text-xl font-bold text-[#0B0C1A]">Contact Us</h2>
          <p>
            If you have any questions about this Privacy Policy, please contact us at{" "}
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
