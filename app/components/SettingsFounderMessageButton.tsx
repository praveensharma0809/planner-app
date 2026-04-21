"use client";

import { useState } from "react";
import { FounderMessageModal } from "./FounderMessageModal";

export function SettingsFounderMessageButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-5 text-sm font-medium text-white/90 transition-all hover:bg-white/[0.08]"
      >
        Read Founder&apos;s Message
      </button>
      <FounderMessageModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
