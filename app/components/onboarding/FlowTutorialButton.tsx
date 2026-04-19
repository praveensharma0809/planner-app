"use client"

import { useCallback, useEffect, useState } from "react"
import Image from "next/image"
import { Button, Modal } from "@/app/components/ui"
import type { ButtonSize, ButtonVariant } from "@/app/components/ui"
import type { GuidedFlowSlide } from "./flowSlides"

const AUTOPLAY_INTERVAL_MS = 1700

interface FlowTutorialButtonProps {
  title: string
  flowLabel: string
  slides: GuidedFlowSlide[]
  buttonLabel?: string
  buttonVariant?: ButtonVariant
  buttonSize?: ButtonSize
  buttonClassName?: string
  modalSize?: "sm" | "md" | "lg" | "xl"
}

export function FlowTutorialButton({
  title,
  flowLabel,
  slides,
  buttonLabel = "Tutorial",
  buttonVariant = "ghost",
  buttonSize = "sm",
  buttonClassName,
  modalSize = "xl",
}: FlowTutorialButtonProps) {
  const [open, setOpen] = useState(false)
  const [activeFrame, setActiveFrame] = useState(0)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const updatePreference = (event: MediaQueryListEvent | MediaQueryList) => {
      setPrefersReducedMotion(event.matches)
    }

    updatePreference(mediaQuery)

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", updatePreference)
      return () => mediaQuery.removeEventListener("change", updatePreference)
    }

    mediaQuery.addListener(updatePreference)
    return () => mediaQuery.removeListener(updatePreference)
  }, [])

  useEffect(() => {
    if (!open || prefersReducedMotion || slides.length < 2) return

    const intervalId = window.setInterval(() => {
      setActiveFrame((current) => (current + 1) % slides.length)
    }, AUTOPLAY_INTERVAL_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [open, prefersReducedMotion, slides.length])

  const handleOpen = useCallback(() => {
    setActiveFrame(0)
    setOpen(true)
  }, [])

  const handleClose = useCallback(() => {
    setOpen(false)
  }, [])

  const handlePrevious = useCallback(() => {
    if (slides.length <= 1) return
    setActiveFrame((current) => (current - 1 + slides.length) % slides.length)
  }, [slides.length])

  const handleNext = useCallback(() => {
    if (slides.length <= 1) return
    setActiveFrame((current) => (current + 1) % slides.length)
  }, [slides.length])

  if (slides.length === 0) return null

  const slide = slides[activeFrame] ?? slides[0]

  return (
    <>
      <Button
        type="button"
        variant={buttonVariant}
        size={buttonSize}
        className={buttonClassName}
        onClick={handleOpen}
      >
        {buttonLabel}
      </Button>

      <Modal
        open={open}
        onClose={handleClose}
        title={title}
        size={modalSize}
      >
        <div className="space-y-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] font-semibold" style={{ color: "var(--sh-text-muted)" }}>
              {flowLabel}
            </p>
            <h3 className="mt-1 text-xl font-bold" style={{ color: "var(--sh-text-primary)" }}>
              {slide.title}
            </h3>
            <p className="mt-1 text-sm" style={{ color: "var(--sh-text-secondary)" }}>
              {slide.description}
            </p>
          </div>

          <div
            className="overflow-hidden rounded-xl border"
            style={{ borderColor: "var(--sh-border)", background: "var(--sh-card)" }}
          >
            <div
              className="flex h-8 items-center gap-1.5 border-b px-3"
              style={{ borderColor: "var(--sh-border)", background: "rgba(255,255,255,0.02)" }}
            >
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/75" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300/75" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/75" />
            </div>

            <Image
              key={slide.image}
              src={slide.image}
              alt={`${flowLabel} step ${activeFrame + 1} of ${slides.length}`}
              width={1919}
              height={1079}
              className="h-auto w-full"
              priority
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={handlePrevious}>
                Prev
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={handleNext}>
                Next
              </Button>
            </div>

            <div className="flex min-w-0 flex-1 items-center gap-2 sm:justify-end">
              <span className="shrink-0 text-xs" style={{ color: "var(--sh-text-muted)" }}>
                Flow {activeFrame + 1}/{slides.length}
              </span>

              <div className="flex min-w-0 flex-1 items-center gap-1 sm:max-w-[320px]">
                {slides.map((_, index) => {
                  const isActive = index === activeFrame
                  const isDone = index < activeFrame

                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setActiveFrame(index)}
                      className="h-1.5 flex-1 rounded-full transition-colors"
                      style={{
                        background: isActive
                          ? "var(--sh-primary)"
                          : isDone
                            ? "rgba(124,108,255,0.45)"
                            : "rgba(255,255,255,0.12)",
                      }}
                      aria-label={`Show ${flowLabel} frame ${index + 1}`}
                    />
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </>
  )
}
