"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { markWelcomed } from "@/app/actions/user/markWelcomed";

interface FounderMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FounderMessageModal({ isOpen, onClose }: FounderMessageModalProps) {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-[500px] max-h-[90vh] flex flex-col bg-[#EEF0FF] rounded-3xl overflow-hidden shadow-[0_24px_50px_rgba(0,0,0,0.5)] transform scale-100 transition-transform duration-300">

        {/* Header */}
        <div className="flex-none flex flex-col items-center pt-6 pb-4 px-6 border-b border-black/[0.06] bg-white">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 mb-4 p-[2px] shadow-md">
            <div className="w-full h-full rounded-full border-2 border-white overflow-hidden bg-white flex items-center justify-center">
              <Image src="/logo.jpg" alt="PrepVeda Logo" width={64} height={64} className="w-full h-full object-cover" />
            </div>
          </div>
          <p className="text-[#454772] font-semibold text-sm tracking-wide">
            Welcome from Praveen Sharma, Founder
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 sm:p-8 space-y-4 bg-white text-[#0B0C1A] overflow-y-auto">
          <h2 className="text-xl font-extrabold tracking-tight">
            Thanks for signing up — your account is ready to go!
          </h2>
          <div className="space-y-4 text-[15px] leading-relaxed text-[#454772] font-medium">
            <p>
              Now you have one central, intelligent place to track your subjects, build your planner, set your deadlines, and make actual progress. PrepVeda is designed to flag impossible study deadlines before you even begin, so you can stop guessing and start scheduling.
            </p>
            <p className="p-4 bg-[#F5F3FF] border border-[#4F46E5]/10 rounded-xl text-[#0B0C1A]">
              <strong>Note:</strong> This is beta version and under testing, users are requested to give their suggestions and report any bugs they come across.
            </p>
            <p className="p-4 bg-[#F5F3FF] border border-[#4F46E5]/10 rounded-xl text-[#0B0C1A]">
              <strong>Currently, the app is optimized for desktop only. We are working on launching apps for mobile users.</strong>
            </p>
            <p>
              If you ever need a help you can email me directly at{" "}
              <a href="mailto:stayyplanned@gmail.com" className="text-[#4F46E5] font-bold hover:underline">
                stayyplanned@gmail.com
              </a>
              . I&apos;m here for you.
            </p>
            <p>Thanks again and all the best,</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-none p-5 sm:p-6 bg-slate-50 border-t border-black/[0.04]">
          <button
            onClick={onClose}
            className="w-full py-4 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white font-bold text-[15px] shadow-lg shadow-[#4F46E5]/20 transition-all active:scale-[0.98]"
          >
            OK, let&apos;s see my account
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

interface GlobalFounderMessageProps {
  showOnMount: boolean;
}

export function GlobalFounderMessage({ showOnMount }: GlobalFounderMessageProps) {
  const [isOpen, setIsOpen] = useState(showOnMount);

  const handleClose = () => {
    setIsOpen(false);
    // Fire-and-forget — no need to await; the user can proceed immediately.
    void markWelcomed();
  };

  return <FounderMessageModal isOpen={isOpen} onClose={handleClose} />;
}
