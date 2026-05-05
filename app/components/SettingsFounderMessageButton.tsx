"use client";

import { useState } from "react";
import { FounderMessageModal } from "./FounderMessageModal";
import { Button } from "@/app/components/ui/Button";

export function SettingsFounderMessageButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant="secondary"
        size="lg"
        className="min-h-[44px]"
      >
        Read Founder&apos;s Message
      </Button>
      <FounderMessageModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
