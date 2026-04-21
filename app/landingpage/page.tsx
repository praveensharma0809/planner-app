"use client";

import Image from "next/image";
import Link from "next/link";
import { Plus_Jakarta_Sans } from "next/font/google";
import { useState, useEffect, useRef } from "react";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const howCards = [
  {
    id: "01",
    tag: "Intake",
    title: "Tell it what you have.",
    body: "Add subjects and chapters, set your exam date, and say how many minutes you can study weekday vs. weekend.",
    image: "/app_screenshots/Planner_Page1.png",
    accent: "#4F46E5",
  },
  {
    id: "02",
    tag: "Preview",
    title: "See if it is feasible.",
    body: "PrepVeda flags each subject as safe, tight, at-risk or impossible and tells you exactly what to tweak.",
    image: "/app_screenshots/Planner_Page2.png",
    accent: "#F43F5E",
  },
  {
    id: "03",
    tag: "Confirm",
    title: "Commit and start.",
    body: "Lock in your schedule. Every day you know exactly which chapters to study, for how long, and what comes next.",
    image: "/app_screenshots/Schedule_Page.png",
    accent: "#10B981",
  },
];

const testimonials = [
  {
    initials: "RK",
    name: "Rohan K.",
    role: "JEE Main Aspirant",
    quote:
      "I used to make a plan on Day 1 and abandon it by Day 3. PrepVeda showed me my Calculus deadline was impossible before I even started. First time I have finished a syllabus on time.",
    tone: "#4F46E5",
  },
  {
    initials: "PS",
    name: "Priya S.",
    role: "UPSC CSE 2026",
    quote:
      "The feasibility bars are game-changing. I had six subjects and no idea which were safe. PrepVeda color-coded everything and told me exactly where to add time.",
    tone: "#F43F5E",
  },
  {
    initials: "AM",
    name: "Aryan M.",
    role: "GATE ECE 2026",
    quote:
      "I travel on weekdays. PrepVeda lets me set different capacities per day, so I am not lying to myself. The calendar view helps me spot crunch weeks in advance.",
    tone: "#7C3AED",
  },
];

const faqItems = [
  {
    q: "Is this an AI model writing my schedule?",
    a: "No. PrepVeda uses a deterministic constraint solver. Same inputs produce the same plan every time.",
  },
  {
    q: "Does it work for my specific exam?",
    a: "PrepVeda is exam-agnostic. If you can break prep into subjects and chapters with effort estimates, it works.",
  },
  {
    q: "What happens when I fall behind or miss a day?",
    a: "Re-run the planner in intake mode and feasibility re-checks immediately with updated constraints.",
  },
  {
    q: "Can I edit the generated schedule by hand?",
    a: "Yes. Drag tasks, mark them complete, and add ad-hoc sessions without losing plan integrity.",
  },
  {
    q: "Is there a free plan?",
    a: "Yes. The free plan includes the full planner, subjects, calendar and schedule.",
  },
];

const heroSlides = [
  { name: "Dashboard", image: "/app_screenshots/Dashboard.png" },
  { name: "Planner", image: "/app_screenshots/Planner_Page2.png" },
  { name: "Calendar", image: "/app_screenshots/Calendar_Page.png" },
  { name: "Schedule", image: "/app_screenshots/Schedule_Page.png" },
  { name: "Subjects", image: "/app_screenshots/Subjects_Page.png" },
];

export default function LandingPage() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [feasibilityVisible, setFeasibilityVisible] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const feasibilityRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [isPaused, heroSlides.length]);

  useEffect(() => {
    const handleVisibilityChange = () => setIsPaused(document.hidden);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setFeasibilityVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    if (feasibilityRef.current) observer.observe(feasibilityRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    document.querySelectorAll('.reveal-up').forEach(el => revealObserver.observe(el));
    return () => revealObserver.disconnect();
  }, []);

  return (
    <div className={`${plusJakarta.className} min-h-screen bg-[#F5F3FF] text-[#0B0C1A] overflow-x-hidden antialiased`}>
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8 cursor-zoom-out"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative w-full max-w-7xl aspect-[16/10] bg-black/50 rounded-2xl overflow-hidden shadow-2xl transition-transform duration-300 transform scale-100">
            <Image src={lightboxImage} alt="Fullscreen preview" fill className="object-contain" quality={100} />
          </div>
          <button className="absolute top-6 right-6 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white backdrop-blur-md transition-colors" onClick={() => setLightboxImage(null)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      )}
      <nav className="fixed top-0 inset-x-0 z-50 h-[68px] bg-white/85 backdrop-blur-xl border-b border-black/[0.06] px-6 lg:px-12">
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between">
          <Link href="/landingpage" className="flex items-center gap-2.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-4">
            <Image
              src="/logo.jpg"
              alt="PrepVeda"
              width={40}
              height={40}
              className="rounded-full object-cover"
              priority
            />
            <div>
              <div className="text-[1.1rem] font-extrabold tracking-tight leading-none">PrepVeda</div>
              <div className="text-[9px] font-bold text-[#9294B4] tracking-[0.18em] uppercase">plan · track · excel</div>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-[#454772]">
            <a href="#how" className="hover:text-[#4F46E5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] rounded transition-colors">How it works</a>
            <a href="#features" className="hover:text-[#4F46E5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] rounded transition-colors">Features</a>
            <a href="#faq" className="hover:text-[#4F46E5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] rounded transition-colors">FAQ</a>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="hidden sm:block text-sm font-bold text-[#454772] hover:text-[#0B0C1A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] rounded transition-colors">
              Log in
            </Link>
            <Link
              href="/auth/login"
              className="px-5 py-2.5 rounded-full bg-[#F43F5E] hover:bg-[#E11D48] text-white text-sm font-bold shadow-[0_8px_32px_rgba(244,63,94,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2 transition-all"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-[68px]">
        <section className="relative min-h-screen flex items-center overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-[-20%] left-[-10%] w-[55%] h-[65%] bg-[#4F46E5]/10 rounded-full blur-[120px] transform-gpu will-change-transform" />
            <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[60%] bg-[#F43F5E]/10 rounded-full blur-[100px] transform-gpu will-change-transform" />
            <div className="absolute inset-0 dot-grid opacity-60" />
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12 py-20 grid lg:grid-cols-[1fr_1.1fr] gap-12 xl:gap-20 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#EEF0FF] border border-[#4F46E5]/20 text-[#4F46E5] text-[11px] font-extrabold tracking-[0.08em] uppercase mb-7">
                <span className="w-1.5 h-1.5 rounded-full bg-[#F43F5E] inline-block" />
                Built for serious exam prep
              </div>

              <h1 className="text-[2.8rem] sm:text-[3.5rem] lg:text-[4.2rem] xl:text-[5rem] font-extrabold leading-[1.02] tracking-tight text-[#0B0C1A] mb-6">
                A study plan
                <br />
                that <span className="accent-gradient-text">actually fits</span>
                <br />
                your life.
              </h1>

              <p className="text-lg xl:text-xl text-[#454772] font-medium leading-relaxed mb-9 max-w-[520px]">
                Tell PrepVeda your subjects, chapters and deadlines. It builds a day-by-day schedule around your real capacity and warns you
                <strong className="text-[#0B0C1A]"> before</strong> you commit to something impossible.
              </p>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-10">
                <Link
                  href="/auth/login"
                  className="px-8 py-4 rounded-2xl bg-[#F43F5E] hover:bg-[#E11D48] text-white font-bold text-base shadow-[0_10px_36px_rgba(244,63,94,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2 transition-all"
                >
                  Start Planning Free
                </Link>
                <a href="#how" className="text-base font-bold text-[#454772] hover:text-[#4F46E5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] rounded transition-colors">See how it works</a>
              </div>

              <div className="flex flex-wrap items-center gap-5 text-sm font-semibold text-[#9294B4]">
                <span>Free plan forever</span>
                <span>No credit card</span>
                <span>&lt; 2s to generate plan</span>
              </div>
            </div>

            <div>
              <div className="rounded-[1.5rem] overflow-hidden border border-black/[0.08] bg-white soft-shadow">
                <div className="h-10 bg-[#F7F8FB] border-b border-black/[0.07] flex items-center px-4 gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-[#FF5F56]" />
                    <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
                    <div className="w-3 h-3 rounded-full bg-[#27C93F]" />
                  </div>
                  <div className="flex-1 h-6 rounded-md bg-white border border-black/[0.08] px-3 text-[10px] font-semibold text-[#9294B4] flex items-center">
                    prepveda.app
                  </div>
                </div>

                <div className="aspect-[16/9.5] bg-[#F5F3FF] relative overflow-hidden">
                  {heroSlides.map((slide, index) => (
                    <Image
                      key={slide.name}
                      src={slide.image}
                      alt={`PrepVeda ${slide.name}`}
                      width={1900}
                      height={1100}
                      className={`absolute inset-0 w-full h-full object-cover object-top transition-opacity duration-700 ${index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
                      priority={index === 0}
                    />
                  ))}
                </div>

                <div className="bg-[#F7F8FB] border-t border-black/[0.06] px-4 py-2.5 flex items-center justify-between">
                  <div className="flex gap-2">
                    {heroSlides.map((_, index) => (
                      <span 
                        key={index} 
                        className={`w-5 h-1.5 rounded-full transition-colors duration-300 ${index === currentSlide ? 'bg-[#4F46E5]' : 'bg-black/10'}`} 
                      />
                    ))}
                  </div>
                  <span className="text-[10px] font-semibold text-[#9294B4] transition-all duration-300">
                    {heroSlides[currentSlide].name}
                  </span>
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-3 mt-4">
                <div className="bg-white rounded-2xl border border-black/[0.05] px-4 py-3 soft-shadow float-card-1">
                  <div className="text-[9px] font-extrabold uppercase tracking-wider text-[#9294B4]">Streak</div>
                  <div className="text-xs font-bold text-[#0B0C1A]">12 days strong</div>
                </div>
                <div className="bg-white rounded-2xl border border-black/[0.05] px-4 py-3 soft-shadow float-card-2">
                  <div className="text-[9px] font-extrabold uppercase tracking-wider text-[#9294B4]">Today</div>
                  <div className="text-xs font-bold text-[#0B0C1A]">4 of 30 tasks done</div>
                </div>
                <div className="bg-white rounded-2xl border border-black/[0.05] px-4 py-3 soft-shadow float-card-3">
                  <div className="text-[9px] font-extrabold uppercase tracking-wider text-[#9294B4]">Heads up</div>
                  <div className="text-xs font-bold text-[#0B0C1A]">Calculus is tight</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-5 px-6 bg-white border-y border-black/[0.06]">
          <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm font-bold text-[#454772]">
            <span className="text-xs uppercase tracking-widest text-[#9294B4]">Used for</span>
            <span>Competitive Entrances</span>
            <span>Board Exams</span>
            <span>Professional Certifications</span>
            <span>Semester Finals</span>
            <span>Any exam you name it</span>
          </div>
        </section>

        <section className="py-24 px-6 bg-white reveal-up">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <div className="inline-flex items-center rounded-full border border-[#F43F5E]/20 bg-[#FFF1F3] px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#F43F5E] mb-5">
                The real problem
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-[#0B0C1A]">Most exam prep fails the same way.</h2>
            </div>

            <div className="grid md:grid-cols-3 gap-5">
              <div className="rounded-3xl border border-black/[0.07] bg-[#F5F3FF] p-8 card-hover reveal-up" style={{ transitionDelay: '100ms' }}>
                <div className="w-12 h-12 rounded-2xl bg-[#FFF1F3] border border-[#F43F5E]/20 flex items-center justify-center mb-6 text-[#F43F5E]">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                </div>
                <h3 className="text-2xl font-extrabold text-[#0B0C1A] mb-3">Plans built on hope</h3>
                <p className="text-[#454772] font-medium leading-relaxed">You set deadlines based on what you wish you could do, not the hours you actually have.</p>
              </div>
              <div className="rounded-3xl border border-black/[0.07] bg-[#F5F3FF] p-8 card-hover reveal-up" style={{ transitionDelay: '200ms' }}>
                <div className="w-12 h-12 rounded-2xl bg-[#EEF0FF] border border-[#4F46E5]/20 flex items-center justify-center mb-6 text-[#4F46E5]">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
                </div>
                <h3 className="text-2xl font-extrabold text-[#0B0C1A] mb-3">Drowning in syllabus</h3>
                <p className="text-[#454772] font-medium leading-relaxed">A dozen subjects, hundreds of chapters, and no clear answer to what do I study right now.</p>
              </div>
              <div className="rounded-3xl border border-black/[0.07] bg-[#F5F3FF] p-8 card-hover reveal-up" style={{ transitionDelay: '300ms' }}>
                <div className="w-12 h-12 rounded-2xl bg-[#ECFDF5] border border-emerald-500/20 flex items-center justify-center mb-6 text-emerald-600">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                </div>
                <h3 className="text-2xl font-extrabold text-[#0B0C1A] mb-3">No early warning</h3>
                <p className="text-[#454772] font-medium leading-relaxed">You only find out the plan was impossible when it is too late to catch up.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="how" className="py-24 px-6 bg-[#F5F3FF] reveal-up">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <div className="inline-flex items-center rounded-full border border-[#4F46E5]/20 bg-[#EEF0FF] px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#4F46E5] mb-5">
                How it works
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-[#0B0C1A] max-w-3xl mx-auto leading-tight">
                Three steps from syllabus chaos to a schedule you trust.
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {howCards.map((card) => (
                <article key={card.id} className="rounded-3xl bg-white border border-black/[0.07] p-7 soft-shadow card-hover">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-11 h-11 rounded-2xl text-white text-sm font-extrabold flex items-center justify-center" style={{ backgroundColor: card.accent }}>
                      {card.id}
                    </div>
                    <span className="text-xs font-extrabold uppercase tracking-widest" style={{ color: card.accent }}>{card.tag}</span>
                  </div>
                  <h3 className="text-xl font-extrabold text-[#0B0C1A] mb-3">{card.title}</h3>
                  <p className="text-[#454772] font-medium text-sm leading-relaxed mb-6">{card.body}</p>
                  <div className="rounded-2xl overflow-hidden border border-black/[0.06] cursor-zoom-in" onClick={() => setLightboxImage(card.image)}>
                    <Image src={card.image} alt={`${card.tag} screenshot`} width={1200} height={750} className="w-full h-auto transition-transform hover:scale-105 duration-500" />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 px-6 bg-white">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-14 items-center">
            <div>
              <div className="inline-flex items-center rounded-full border border-amber-300/70 bg-amber-50 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.08em] text-amber-600 mb-6">
                The unfair advantage
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-[#0B0C1A] mb-6 leading-tight">
                The only planner that tells you <span className="text-[#F43F5E]">the truth</span> before you start.
              </h2>
              <p className="text-lg text-[#454772] font-medium leading-relaxed mb-8">
                PrepVeda models every session against your real capacity: weekday minutes, weekend minutes, flexibility buffer, and off-days.
              </p>
              <div className="space-y-3">
                <div className="feas-label"><span className="bar bg-emerald-500" />Safe <span className="meta">&lt; 80% capacity</span></div>
                <div className="feas-label"><span className="bar bg-amber-400" />Tight <span className="meta">80 - 90%</span></div>
                <div className="feas-label"><span className="bar bg-[#F43F5E]" />At risk <span className="meta">&gt; 90%</span></div>
                <div className="feas-label"><span className="bar bg-red-600" />Impossible <span className="meta">Deadline breach</span></div>
              </div>
            </div>

            <div ref={feasibilityRef} className="rounded-3xl border border-black/[0.07] bg-[#F5F3FF] p-7 soft-shadow">
              <div className="flex items-center justify-between mb-6">
                <span className="text-sm font-extrabold uppercase tracking-wide text-[#0B0C1A]">Feasibility Preview</span>
                <span className="text-xs font-mono text-[#9294B4]">plan #042</span>
              </div>

              <div className="space-y-3 mb-6">
                {[
                  ["Mathematics", 68, "#10B981", "Safe"],
                  ["Physics", 74, "#10B981", "Safe"],
                  ["Calculus", 87, "#F59E0B", "Tight"],
                  ["AI & ML", 94, "#F43F5E", "At risk"],
                  ["P&S", 62, "#10B981", "Safe"],
                ].map((row) => (
                  <div key={row[0] as string} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-sm font-bold text-[#0B0C1A]">{row[0]}</span>
                    <div className="flex-1 h-2 rounded-full bg-black/10 overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-1000 ease-out" 
                        style={{ 
                          width: feasibilityVisible ? `${row[1]}%` : '0%', 
                          backgroundColor: row[2] as string 
                        }} 
                      />
                    </div>
                    <span className="text-xs font-mono text-[#9294B4] w-9 text-right">{row[1]}%</span>
                    <span className="hidden sm:inline-block text-[10px] font-extrabold uppercase tracking-wider px-2 py-1 rounded-full border border-black/10 bg-white text-[#454772]">
                      {row[3]}
                    </span>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-[#454772]">
                <strong className="text-[#0B0C1A]">AI & ML is 94% of capacity.</strong> Add <strong className="text-amber-600">+15 min/day</strong> or extend by
                <strong className="text-amber-600"> 2 days</strong> to reach safe.
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="py-24 px-6 bg-[#F5F3FF] reveal-up">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-20">
              <div className="inline-flex items-center rounded-full border border-violet-200 bg-violet-100 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.08em] text-violet-600 mb-5">
                Everything you need
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-[#0B0C1A] max-w-3xl mx-auto leading-tight">
                Every tool you need to own your prep.
              </h2>
            </div>

            <div className="space-y-24">
              <div className="grid md:grid-cols-2 gap-10 lg:gap-20 items-center">
                <div className="rounded-[1.5rem] overflow-hidden border border-black/[0.07] soft-shadow card-hover cursor-zoom-in group" onClick={() => setLightboxImage("/app_screenshots/Subjects_Page.png")}>
                  <Image src="/app_screenshots/Subjects_Page.png" alt="Subjects page" width={1600} height={1000} className="w-full h-auto transition-transform group-hover:scale-105 duration-500" />
                </div>
                <div>
                  <div className="feature-pill text-[#4F46E5] bg-[#EEF0FF] border-[#4F46E5]/20">01 · Subjects & Chapters</div>
                  <h3 className="feature-title">Your entire syllabus, <span className="text-[#4F46E5]">structured.</span></h3>
                  <p className="feature-body">Group material into subjects. Break each into chapters with effort estimates, session lengths and deadlines.</p>
                  <ul className="feature-list">
                    <li>Unlimited subjects and chapters</li>
                    <li>Live per-chapter completion tracking</li>
                    <li>Lock prerequisites with dependencies</li>
                  </ul>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-10 lg:gap-20 items-center">
                <div className="md:order-2 rounded-[1.5rem] overflow-hidden border border-black/[0.07] soft-shadow card-hover cursor-zoom-in group" onClick={() => setLightboxImage("/app_screenshots/Planner_Page2.png")}>
                  <Image src="/app_screenshots/Planner_Page2.png" alt="Planner page" width={1600} height={1000} className="w-full h-auto transition-transform group-hover:scale-105 duration-500" />
                </div>
                <div className="md:order-1">
                  <div className="feature-pill text-[#F43F5E] bg-[#FFF1F3] border-[#F43F5E]/20">02 · The Planner</div>
                  <h3 className="feature-title">Schedules that respect your <span className="text-[#F43F5E]">real life.</span></h3>
                  <p className="feature-body">Set weekday and weekend capacity separately. Add a flexibility buffer for overflow days. Override specific dates for travel and rest.</p>
                  <ul className="feature-list">
                    <li>Weekday vs weekend capacity</li>
                    <li>Flexibility buffer for overflow days</li>
                    <li>Per-day custom capacity overrides</li>
                  </ul>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-10 lg:gap-20 items-center">
                <div className="rounded-[1.5rem] overflow-hidden border border-black/[0.07] soft-shadow card-hover cursor-zoom-in group" onClick={() => setLightboxImage("/app_screenshots/Calendar_Page.png")}>
                  <Image src="/app_screenshots/Calendar_Page.png" alt="Calendar page" width={1600} height={1000} className="w-full h-auto transition-transform group-hover:scale-105 duration-500" />
                </div>
                <div>
                  <div className="feature-pill text-violet-600 bg-violet-100 border-violet-200">03 · Calendar View</div>
                  <h3 className="feature-title">See the <span className="text-violet-600">whole month</span> at a glance.</h3>
                  <p className="feature-body">Every scheduled session, color-coded by subject. Spot dense weeks before they happen.</p>
                  <ul className="feature-list">
                    <li>Monthly view of every session</li>
                    <li>Color-coded subject filters</li>
                    <li>Spot busy weeks in advance</li>
                  </ul>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-10 lg:gap-20 items-center">
                <div className="md:order-2 rounded-[1.5rem] overflow-hidden border border-black/[0.07] soft-shadow card-hover cursor-zoom-in group" onClick={() => setLightboxImage("/app_screenshots/Schedule_Page.png")}>
                  <Image src="/app_screenshots/Schedule_Page.png" alt="Schedule page" width={1600} height={1000} className="w-full h-auto transition-transform group-hover:scale-105 duration-500" />
                </div>
                <div className="md:order-1">
                  <div className="feature-pill text-emerald-600 bg-emerald-50 border-emerald-200">04 · Weekly Schedule</div>
                  <h3 className="feature-title">Drag, reschedule, <span className="text-emerald-600">done.</span></h3>
                  <p className="feature-body">Your week laid out day by day. Drag tasks, mark complete, and add last-minute sessions.</p>
                  <ul className="feature-list">
                    <li>One-tap task completion</li>
                    <li>Drag-and-drop rescheduling</li>
                    <li>Streak and focus tracking</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>



        <section className="py-24 px-6 bg-[#F5F3FF] reveal-up">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <div className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.08em] text-emerald-600 mb-5">
                From the community
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-[#0B0C1A]">Students who made the switch.</h2>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {testimonials.map((item) => (
                <article key={item.name} className="rounded-3xl bg-white border border-black/[0.07] p-7 soft-shadow card-hover">
                  <div className="mb-4 text-[#0B0C1A]">★★★★★</div>
                  <p className="text-[#454772] font-medium leading-relaxed mb-6">{item.quote}</p>
                  <div className="pt-5 border-t border-black/[0.06] flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-extrabold" style={{ backgroundColor: `${item.tone}20`, color: item.tone }}>
                      {item.initials}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[#0B0C1A]">{item.name}</div>
                      <div className="text-xs font-medium text-[#9294B4]">{item.role}</div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 px-6 bg-white">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.08em] text-emerald-600 mb-6">
              Pricing
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B0C1A] mb-4">Free to start. Always.</h2>
            <p className="text-lg text-[#454772] font-medium mb-10">Full planner, subjects, calendar and schedule on the free plan. Pro features coming soon.</p>

            <div className="grid sm:grid-cols-2 gap-5 text-left">
              <div className="rounded-3xl border-2 border-[#4F46E5]/20 bg-[#F5F3FF] p-7">
                <div className="text-xs font-extrabold uppercase tracking-widest text-[#4F46E5] mb-3">Free</div>
                <div className="text-4xl font-extrabold text-[#0B0C1A] mb-1">$0 <span className="text-base font-semibold text-[#9294B4]">/forever</span></div>
                <div className="text-sm text-[#9294B4] mb-6">No card required</div>
                <ul className="space-y-2.5 mb-7 text-sm font-medium text-[#454772]">
                  <li>Unlimited subjects and chapters</li>
                  <li>Feasibility preview</li>
                  <li>Calendar and weekly schedule</li>
                  <li>Streak tracking</li>
                </ul>
                <Link href="/auth/login" className="block text-center py-3 rounded-xl bg-[#4F46E5] text-white font-bold text-sm hover:bg-[#4338CA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2 transition-colors">
                  Get started free
                </Link>
              </div>

              <div className="rounded-3xl border border-black/[0.07] bg-[#F5F3FF] p-7 relative">
                <div className="absolute top-4 right-4 text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full bg-amber-100 text-amber-600 border border-amber-200">
                  Coming soon
                </div>
                <div className="text-xs font-extrabold uppercase tracking-widest text-[#9294B4] mb-3">Pro</div>
                <div className="text-4xl font-extrabold text-[#9294B4] mb-1">TBD</div>
                <div className="text-sm text-[#9294B4] mb-6">Join waitlist for early access</div>
                <ul className="space-y-2.5 mb-7 text-sm font-medium text-[#9294B4]">
                  <li>Everything in Free</li>
                  <li>Smart revision scheduling</li>
                  <li>Analytics and insights</li>
                  <li>Priority support</li>
                </ul>
                <button type="button" className="w-full py-3 rounded-xl bg-white border border-black/[0.1] text-[#9294B4] font-bold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2">
                  Notify me
                </button>
              </div>
            </div>
          </div>
        </section>

        <section id="faq" className="py-24 px-6 bg-[#F5F3FF] reveal-up">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-14">
              <div className="inline-flex items-center rounded-full border border-[#4F46E5]/20 bg-[#EEF0FF] px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#4F46E5] mb-5">
                Questions
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-[#0B0C1A]">Still wondering?</h2>
            </div>

            <div className="space-y-3">
              {faqItems.map((item) => (
                <details key={item.q} className="group rounded-2xl border border-black/[0.07] bg-white overflow-hidden soft-shadow">
                  <summary className="list-none flex items-center justify-between gap-4 cursor-pointer px-6 py-5 hover:bg-[#F5F3FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:bg-[#F5F3FF] transition-colors">
                    <span className="text-base font-bold text-[#0B0C1A] pr-4">{item.q}</span>
                    <span className="faq-plus w-8 h-8 rounded-full border border-black/[0.08] bg-[#F5F3FF] flex items-center justify-center text-[#4F46E5] font-extrabold text-lg leading-none transition-transform">
                      +
                    </span>
                  </summary>
                  <div className="px-6 pb-6 text-[#454772] leading-relaxed font-medium">{item.a}</div>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 px-6 bg-[#0B0C1A] relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-[#4F46E5]/30 rounded-full blur-[120px] transform-gpu will-change-transform" />
            <div className="absolute -bottom-32 -left-32 w-[400px] h-[400px] bg-[#F43F5E]/20 rounded-full blur-[100px] transform-gpu will-change-transform" />
            <div className="absolute inset-0 line-grid opacity-20" />
          </div>

          <div className="relative z-10 max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.08em] text-white/80 mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F43F5E]" />
              Ready when you are
            </div>
            <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-white mb-6 leading-[1.02]">
              Stop guessing.
              <br />
              <span className="accent-gradient-text">Start scheduling.</span>
            </h2>
            <p className="text-xl text-white/60 font-medium mb-10 max-w-xl mx-auto">Build your first feasibility-checked plan in under 5 minutes.</p>
            <Link
              href="/auth/login"
              className="inline-flex px-10 py-5 rounded-2xl bg-[#F43F5E] hover:bg-[#E11D48] text-white text-lg font-bold shadow-[0_12px_48px_rgba(244,63,94,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0C1A] transition-all"
            >
              Create your plan
            </Link>
            <div className="mt-5 text-sm font-semibold text-white/30">No credit card · Free plan forever</div>
          </div>
        </section>

        <footer className="bg-[#0B0C1A] border-t border-white/10 py-10 px-6">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-5">
            <div className="flex items-center gap-2.5">
              <Image src="/logo.jpg" alt="PrepVeda" width={32} height={32} className="rounded-full object-cover" />
              <span className="text-white font-extrabold">PrepVeda</span>
            </div>
            <div className="text-sm font-medium text-white/40">&copy; {new Date().getFullYear()} PrepVeda · All rights reserved.</div>
            <div className="flex flex-wrap justify-center gap-6 items-center text-sm font-bold text-white/40">
              <Link href="/privacy" className="hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded transition-colors">Terms</Link>
              <a href="mailto:stayyplanned@gmail.com" className="hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded transition-colors">Contact</a>
              <div className="w-px h-4 bg-white/20 hidden sm:block" />
              <a href="https://instagram.com/prepvedaa" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
                <span>@prepvedaa</span>
              </a>
            </div>
          </div>
        </footer>
      </main>

      <style>{`
        .dot-grid {
          background-image: radial-gradient(circle, rgba(79, 70, 229, 0.18) 1px, transparent 1px);
          background-size: 28px 28px;
        }

        .line-grid {
          background-image: linear-gradient(rgba(79, 70, 229, 0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(79, 70, 229, 0.08) 1px, transparent 1px);
          background-size: 48px 48px;
        }

        .soft-shadow {
          box-shadow: 0 1px 3px rgba(79, 70, 229, 0.07), 0 8px 24px rgba(79, 70, 229, 0.09);
        }

        .card-hover {
          transition: transform 0.25s ease, box-shadow 0.25s ease;
        }

        .card-hover:hover {
          transform: translateY(-4px);
          box-shadow: 0 4px 8px rgba(79, 70, 229, 0.08), 0 20px 48px rgba(79, 70, 229, 0.14);
        }

        .accent-gradient-text {
          background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 52%, #f43f5e 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: shine 4s linear infinite;
        }

        @keyframes shine {
          to {
            background-position: 200% center;
          }
        }

        @keyframes float1 { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        @keyframes float2 { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
        @keyframes float3 { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }

        .float-card-1 { animation: float1 4s ease-in-out infinite; }
        .float-card-2 { animation: float2 5s ease-in-out infinite; }
        .float-card-3 { animation: float3 4.5s ease-in-out infinite; }

        .reveal-up {
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.8s ease-out, transform 0.8s ease-out;
        }

        .reveal-up.is-revealed {
          opacity: 1;
          transform: translateY(0);
        }

        .feature-pill {
          display: inline-flex;
          align-items: center;
          border-width: 1px;
          border-radius: 9999px;
          padding: 0.45rem 0.95rem;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 1.25rem;
        }

        .feature-title {
          font-size: clamp(1.8rem, 3vw, 2.45rem);
          line-height: 1.15;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: #0b0c1a;
          margin-bottom: 1rem;
        }

        .feature-body {
          color: #454772;
          font-weight: 500;
          font-size: 1.05rem;
          line-height: 1.75;
          margin-bottom: 1.25rem;
        }

        .feature-list {
          color: #454772;
          font-weight: 600;
          display: grid;
          gap: 0.65rem;
        }

        .stat {
          font-size: clamp(2.35rem, 6vw, 4rem);
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1;
          margin-bottom: 0.45rem;
        }

        .stat-label {
          color: #9294b4;
          font-size: 0.9rem;
          font-weight: 600;
        }

        .feas-label {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.9rem 1rem;
          border: 1px solid rgba(0, 0, 0, 0.07);
          border-radius: 0.85rem;
          background: #f5f3ff;
          font-weight: 700;
          color: #0b0c1a;
        }

        .feas-label .bar {
          width: 8px;
          height: 30px;
          border-radius: 999px;
          display: inline-block;
          flex-shrink: 0;
        }

        .feas-label .meta {
          margin-left: auto;
          color: #7f81a6;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 0.92rem;
          font-weight: 500;
        }

        details[open] summary .faq-plus {
          transform: rotate(45deg);
        }

        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            animation: none !important;
            transition: none !important;
            scroll-behavior: auto !important;
          }
        }
      `}</style>
    </div>
  );
}
