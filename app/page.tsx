import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  Sparkles,
  CalendarCheck,
  Layers,
  Gauge,
  ShieldCheck,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Brain,
  Flame,
  Compass,
  Settings2,
  ListChecks,
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#07080F] text-[#E6E8F0] font-sans overflow-x-hidden selection:bg-[#6366F1]/30 antialiased">
      {/* ─────────────────── Global atmospheric background ─────────────────── */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-25%] left-[-15%] w-[70%] h-[70%] bg-[#6366F1]/12 blur-[140px] rounded-full" />
        <div className="absolute top-[30%] right-[-15%] w-[60%] h-[60%] bg-[#8B5CF6]/10 blur-[130px] rounded-full" />
        <div className="absolute bottom-[-20%] left-[20%] w-[55%] h-[55%] bg-[#FB7185]/8 blur-[140px] rounded-full" />
        {/* grid texture */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }}
        />
      </div>

      {/* ─────────────────── Navbar ─────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-[#07080F]/75 border-b border-white/5 h-[72px] flex items-center px-6 lg:px-12">
        <div className="container max-w-7xl mx-auto flex justify-between items-center w-full">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#12151E] shadow-md flex items-center justify-center p-1 border border-white/[0.08]">
              <Image src="/logo.png" alt="PrepVeda" width={28} height={28} className="object-contain" priority />
            </div>
            <span className="font-extrabold text-2xl tracking-tight text-white">PrepVeda</span>
          </div>
          <div className="hidden md:flex gap-8 items-center text-sm font-medium text-white/60">
            <a href="#how" className="hover:text-white transition-colors">How it works</a>
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </div>
          <div className="flex gap-3 sm:gap-5 items-center">
            <Link href="/auth/login" className="hidden sm:block text-sm font-semibold text-white/70 hover:text-white transition-colors">
              Log in
            </Link>
            <Link
              href="/auth/login"
              className="px-5 py-2.5 text-sm font-bold bg-white text-[#07080F] hover:bg-[#F0F2F5] rounded-full transition-all shadow-[0_4px_14px_rgba(255,255,255,0.15)] hover:shadow-[0_6px_20px_rgba(255,255,255,0.25)] hover:-translate-y-0.5"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      <main className="relative z-10 pt-[72px]">
        {/* ─────────────────── HERO ─────────────────── */}
        <section className="relative pt-24 md:pt-32 pb-20 md:pb-28 px-6">
          <div className="max-w-7xl mx-auto grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-16 items-center">
            {/* Copy */}
            <div className="relative">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] border border-white/10 backdrop-blur-sm mb-8">
                <Sparkles className="w-4 h-4 text-[#FB7185]" />
                <span className="text-xs font-bold text-white/80 tracking-wide uppercase">Built for serious exam prep</span>
              </div>

              <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight mb-7 leading-[1.02] text-white">
                A study plan <br className="hidden sm:block" />
                that{' '}
                <span className="relative inline-block">
                  <span className="relative z-10 text-white">actually fits</span>
                  <span className="absolute inset-0 bg-gradient-to-r from-[#FB7185] via-[#F59E0B] to-[#FB7185] -skew-x-3 rounded-lg -z-0 top-2 bottom-2 -left-2 -right-2 opacity-90" />
                </span>
                <br />
                your life.
              </h1>

              <p className="text-lg sm:text-xl text-white/60 mb-10 max-w-xl leading-relaxed font-medium">
                Tell PrepVeda your subjects, chapters and deadlines. It builds a
                day-by-day schedule around your real capacity — and warns you
                <span className="text-white/85"> before </span>
                you commit to something impossible.
              </p>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-10">
                <Link
                  href="/auth/login"
                  className="group px-8 py-4 bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-full font-bold text-base transition-all shadow-[0_8px_30px_rgba(99,102,241,0.35)] hover:shadow-[0_12px_40px_rgba(99,102,241,0.5)] flex items-center gap-3 hover:-translate-y-1"
                >
                  Start Planning Free
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <a
                  href="#how"
                  className="px-6 py-4 text-base font-semibold text-white/80 hover:text-white transition-colors"
                >
                  See how it works →
                </a>
              </div>

              <div className="flex items-center gap-6 text-xs text-white/40 font-medium">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#34D399]" /> Free plan forever
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#34D399]" /> No credit card
                </div>
              </div>
            </div>

            {/* Hero visual: dashboard on podium with floating callouts */}
            <div className="relative">
              {/* Ambient glows behind hero card */}
              <div className="absolute -inset-10 pointer-events-none">
                <div className="absolute top-10 right-0 w-80 h-80 bg-[#6366F1]/40 blur-[100px] rounded-full" />
                <div className="absolute bottom-0 left-0 w-72 h-72 bg-[#FB7185]/25 blur-[90px] rounded-full" />
              </div>

              {/* Main screenshot panel */}
              <div className="relative rounded-2xl bg-[#12151E] p-2 border border-white/[0.08] shadow-[0_40px_120px_-15px_rgba(0,0,0,0.8)] transform lg:rotate-x-1 lg:-rotate-y-3 lg:perspective-1000">
                <div className="h-8 border-b border-white/[0.05] flex items-center px-3 gap-1.5 bg-[#0F1219] rounded-t-xl">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#27C93F]/80" />
                  <div className="ml-auto text-[10px] text-white/30 font-mono tracking-wider">prepveda.app/overview</div>
                </div>
                <Image
                  src="/app_screenshots/Dashboard.png"
                  alt="PrepVeda Dashboard"
                  width={1920}
                  height={1080}
                  className="rounded-b-xl w-full"
                  priority
                />
              </div>

              {/* Floating callout 1 — top left */}
              <div className="absolute -left-6 top-10 hidden sm:flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#12151E]/95 backdrop-blur-md border border-white/10 shadow-xl animate-float-slow">
                <div className="w-10 h-10 rounded-xl bg-[#6366F1]/15 flex items-center justify-center">
                  <Flame className="w-5 h-5 text-[#FB7185]" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Streak</div>
                  <div className="text-sm font-bold text-white">12 days strong</div>
                </div>
              </div>

              {/* Floating callout 2 — right */}
              <div className="absolute -right-4 top-1/3 hidden sm:flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#12151E]/95 backdrop-blur-md border border-white/10 shadow-xl animate-float">
                <div className="w-10 h-10 rounded-xl bg-[#34D399]/15 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-[#34D399]" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Today</div>
                  <div className="text-sm font-bold text-white">4 of 30 tasks</div>
                </div>
              </div>

              {/* Floating callout 3 — bottom */}
              <div className="absolute -bottom-6 left-10 hidden sm:flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#12151E]/95 backdrop-blur-md border border-white/10 shadow-xl animate-float-delay">
                <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/15 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-[#F59E0B]" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Heads up</div>
                  <div className="text-sm font-bold text-white">Calculus is tight</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─────────────────── PAIN STRIP ─────────────────── */}
        <section className="px-6 pb-24">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <div className="inline-block text-xs font-bold text-[#FB7185] tracking-[0.2em] uppercase mb-4">The real problem</div>
              <h2 className="text-3xl md:text-5xl font-black tracking-tight text-white leading-tight">
                Most exam prep fails the same way.
              </h2>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {[
                {
                  icon: Compass,
                  title: 'Plans built on hope',
                  body: 'You set deadlines based on what you wish you could do — not the hours you actually have.',
                  tint: 'from-[#FB7185]/20 to-transparent',
                  iconTint: 'text-[#FB7185]',
                },
                {
                  icon: Brain,
                  title: 'Drowning in syllabus',
                  body: 'A dozen subjects, hundreds of chapters, and no clear answer to "what do I study right now?"',
                  tint: 'from-[#F59E0B]/20 to-transparent',
                  iconTint: 'text-[#F59E0B]',
                },
                {
                  icon: Gauge,
                  title: 'No early warning',
                  body: 'You only find out the plan was impossible when it\'s too late to catch up.',
                  tint: 'from-[#8B5CF6]/20 to-transparent',
                  iconTint: 'text-[#8B5CF6]',
                },
              ].map(({ icon: Icon, title, body, tint, iconTint }) => (
                <div
                  key={title}
                  className="group relative rounded-3xl border border-white/[0.08] bg-[#0F1219] p-7 hover:-translate-y-1 hover:border-white/20 transition-all overflow-hidden"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${tint} opacity-0 group-hover:opacity-100 transition-opacity`} />
                  <div className="relative">
                    <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-5">
                      <Icon className={`w-5 h-5 ${iconTint}`} />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
                    <p className="text-sm text-white/55 leading-relaxed">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─────────────────── HOW IT WORKS ─────────────────── */}
        <section id="how" className="relative px-6 py-24 border-t border-white/[0.06]">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <div className="inline-block text-xs font-bold text-[#6366F1] tracking-[0.2em] uppercase mb-4">How it works</div>
              <h2 className="text-3xl md:text-5xl font-black tracking-tight text-white leading-tight max-w-3xl mx-auto">
                Three steps from syllabus chaos to a schedule you trust.
              </h2>
            </div>

            <div className="relative grid md:grid-cols-3 gap-6 md:gap-4">
              {/* connector line */}
              <div className="hidden md:block absolute top-20 left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

              {[
                {
                  step: '01',
                  tag: 'Intake',
                  title: 'Tell it what you have.',
                  body: 'Add your subjects and chapters, set your exam date, and say how many minutes you can study on weekdays vs. weekends.',
                  img: '/app_screenshots/Planner_Page1.png',
                  accent: '#6366F1',
                },
                {
                  step: '02',
                  tag: 'Preview',
                  title: 'See if it\'s feasible.',
                  body: 'PrepVeda flags chapters as safe, tight, at-risk or impossible — and tells you exactly what to adjust to make the plan fit.',
                  img: '/app_screenshots/Planner_Page2.png',
                  accent: '#FB7185',
                },
                {
                  step: '03',
                  tag: 'Confirm',
                  title: 'Commit and start.',
                  body: 'Lock in your schedule. Every day you know exactly which chapters to study, for how long, and what comes next.',
                  img: '/app_screenshots/Schedule_Page.png',
                  accent: '#34D399',
                },
              ].map(({ step, tag, title, body, img, accent }) => (
                <div key={step} className="relative">
                  <div className="rounded-3xl border border-white/[0.08] bg-[#0F1219] p-6 h-full">
                    <div className="flex items-center gap-3 mb-5">
                      <div
                        className="w-10 h-10 rounded-xl border border-white/10 flex items-center justify-center text-sm font-black"
                        style={{ color: accent, background: `${accent}15` }}
                      >
                        {step}
                      </div>
                      <div
                        className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border"
                        style={{ color: accent, borderColor: `${accent}40`, background: `${accent}10` }}
                      >
                        {tag}
                      </div>
                    </div>
                    <h3 className="text-xl font-extrabold text-white mb-3 leading-snug">{title}</h3>
                    <p className="text-sm text-white/55 leading-relaxed mb-6">{body}</p>
                    <div className="relative rounded-xl overflow-hidden border border-white/10 bg-[#07080F]">
                      <Image src={img} alt={tag} width={800} height={500} className="w-full" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─────────────────── FEASIBILITY WEDGE ─────────────────── */}
        <section className="relative px-6 py-28 border-t border-white/[0.06]">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_1.1fr] gap-12 items-center">
            <div>
              <div className="inline-block text-xs font-bold text-[#F59E0B] tracking-[0.2em] uppercase mb-5">The unfair advantage</div>
              <h2 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-6 leading-tight">
                The only planner that tells you{' '}
                <span className="text-[#FB7185]">the truth</span> before you start.
              </h2>
              <p className="text-lg text-white/60 leading-relaxed mb-8 font-medium">
                PrepVeda models every session against your real capacity — weekday
                minutes, weekend minutes, flexibility buffer, off-days, and hard
                caps. If your plan doesn&apos;t fit, it tells you{' '}
                <span className="text-white/90">exactly</span> what to change.
              </p>
              <div className="space-y-3">
                {[
                  { label: 'Safe', pct: '< 80% capacity', color: '#34D399' },
                  { label: 'Tight', pct: '80 – 90%', color: '#F59E0B' },
                  { label: 'At risk', pct: '> 90%', color: '#FB7185' },
                  { label: 'Impossible', pct: 'Deadline breach', color: '#EF4444' },
                ].map(({ label, pct, color }) => (
                  <div
                    key={label}
                    className="flex items-center gap-4 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/10"
                  >
                    <div className="w-2 h-8 rounded-full" style={{ background: color }} />
                    <div className="flex-1 flex items-center justify-between">
                      <span className="text-sm font-bold text-white">{label}</span>
                      <span className="text-xs font-mono text-white/40">{pct}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mock feasibility report */}
            <div className="relative">
              <div className="absolute -inset-6 bg-gradient-to-br from-[#FB7185]/20 via-[#6366F1]/15 to-transparent blur-3xl -z-10" />
              <div className="rounded-3xl border border-white/10 bg-[#0F1219] p-7 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-white/50" />
                    <span className="text-xs font-bold text-white/60 uppercase tracking-wider">Feasibility preview</span>
                  </div>
                  <span className="text-[10px] font-mono text-white/30">plan #042</span>
                </div>
                <div className="space-y-2.5">
                  {[
                    { name: 'Mathematics', state: 'Safe', pct: 68, color: '#34D399' },
                    { name: 'Physics', state: 'Safe', pct: 74, color: '#34D399' },
                    { name: 'Calculus', state: 'Tight', pct: 87, color: '#F59E0B' },
                    { name: 'AI & ML', state: 'At risk', pct: 94, color: '#FB7185' },
                    { name: 'P&S', state: 'Safe', pct: 62, color: '#34D399' },
                  ].map(({ name, state, pct, color }) => (
                    <div key={name} className="flex items-center gap-4 py-2">
                      <span className="text-sm font-semibold text-white w-32">{name}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                      </div>
                      <span className="text-xs font-mono text-white/50 w-10 text-right">{pct}%</span>
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border"
                        style={{ color, borderColor: `${color}40`, background: `${color}15` }}
                      >
                        {state}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 pt-5 border-t border-white/[0.06] flex items-start gap-3 px-4 py-3 rounded-xl bg-[#F59E0B]/[0.07] border border-[#F59E0B]/30">
                  <AlertTriangle className="w-4 h-4 text-[#F59E0B] mt-0.5 shrink-0" />
                  <div className="text-xs text-white/80 leading-relaxed">
                    <span className="font-bold text-white">AI & ML is 94% of capacity.</span>{' '}
                    Add <span className="text-[#F59E0B] font-bold">+15 min/day</span> or extend the deadline by{' '}
                    <span className="text-[#F59E0B] font-bold">2 days</span> to reach safe.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─────────────────── FEATURE BLOCKS ─────────────────── */}
        <section id="features" className="relative px-6 py-24 border-t border-white/[0.06] bg-[#090A11]/60">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-20">
              <div className="inline-block text-xs font-bold text-[#8B5CF6] tracking-[0.2em] uppercase mb-4">Everything you need</div>
              <h2 className="text-3xl md:text-5xl font-black tracking-tight text-white leading-tight max-w-3xl mx-auto">
                Every tool you need to own your prep — in one workspace.
              </h2>
            </div>

            <div className="space-y-32 md:space-y-40">
              {/* Feature 1 — Subjects */}
              <FeatureBlock
                reverse={false}
                index="01"
                eyebrow="Subjects & Chapters"
                title={<>Your entire syllabus, <span className="text-[#6366F1]">structured.</span></>}
                body="Group your material into subjects. Break each subject into chapters with effort estimates, session lengths, start dates and deadlines. Set chapter dependencies so prerequisites always come first."
                img="/app_screenshots/Subjects_Page.png"
                accent="#6366F1"
                stickers={[
                  { icon: Layers, label: 'Chapter dependencies', pos: 'top-6 -left-8', tint: '#6366F1' },
                  { icon: ListChecks, label: '11 / 50 completed', pos: 'bottom-8 -right-6', tint: '#34D399' },
                ]}
                bullets={[
                  { icon: Layers, text: 'Organise unlimited subjects & chapters' },
                  { icon: ListChecks, text: 'Track per-chapter completion live' },
                  { icon: ShieldCheck, text: 'Lock prerequisites with dependencies' },
                ]}
              />

              {/* Feature 2 — Planner */}
              <FeatureBlock
                reverse={true}
                index="02"
                eyebrow="The Planner"
                title={<>Schedules that respect your <span className="text-[#FB7185]">real life.</span></>}
                body="Set weekday and weekend capacity separately. Add a flexibility buffer for overflow days. Override specific dates for travel, exams or rest. PrepVeda respects every constraint — not just an average."
                img="/app_screenshots/Planner_Page2.png"
                accent="#FB7185"
                stickers={[
                  { icon: Clock, label: 'Weekend: 420 min', pos: '-top-4 right-6', tint: '#FB7185' },
                  { icon: Settings2, label: 'Flexibility: 60 min', pos: 'bottom-6 -left-8', tint: '#F59E0B' },
                ]}
                bullets={[
                  { icon: Clock, text: 'Weekday vs. weekend capacity' },
                  { icon: Settings2, text: 'Flexibility buffer for overflow days' },
                  { icon: CalendarCheck, text: 'Per-day custom capacity overrides' },
                ]}
              />

              {/* Feature 3 — Calendar */}
              <FeatureBlock
                reverse={false}
                index="03"
                eyebrow="Calendar View"
                title={<>See the <span className="text-[#8B5CF6]">whole month</span> at a glance.</>}
                body="Every scheduled session, colour-coded by subject. Spot dense weeks before they happen. Switch between subjects to check coverage, or zoom in to a single day."
                img="/app_screenshots/Calendar_Page.png"
                accent="#8B5CF6"
                stickers={[
                  { icon: CalendarCheck, label: 'April 2026', pos: 'top-8 -right-6', tint: '#8B5CF6' },
                ]}
                bullets={[
                  { icon: CalendarCheck, text: 'Monthly view of every session' },
                  { icon: Layers, text: 'Colour-coded subject filters' },
                  { icon: TrendingUp, text: 'Spot busy weeks in advance' },
                ]}
              />

              {/* Feature 4 — Schedule */}
              <FeatureBlock
                reverse={true}
                index="04"
                eyebrow="Weekly Schedule"
                title={<>Drag, reschedule, <span className="text-[#34D399]">done.</span></>}
                body="Your week laid out day by day. Drag a task to tomorrow, mark it complete, or add a last-minute session. Every change respects the plan's feasibility rules — no accidental overloading."
                img="/app_screenshots/Schedule_Page.png"
                accent="#34D399"
                stickers={[
                  { icon: CheckCircle2, label: 'Drag-and-drop', pos: 'top-6 -left-6', tint: '#34D399' },
                  { icon: Flame, label: 'Track streaks', pos: '-bottom-4 right-10', tint: '#FB7185' },
                ]}
                bullets={[
                  { icon: CheckCircle2, text: 'One-tap task completion' },
                  { icon: CalendarCheck, text: 'Drag-and-drop rescheduling' },
                  { icon: Flame, text: 'Streak and focus tracking' },
                ]}
              />
            </div>
          </div>
        </section>

        {/* ─────────────────── STATS STRIP ─────────────────── */}
        <section className="px-6 py-20 border-t border-white/[0.06]">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-10">
              {[
                { n: '100+', l: 'Chapters per plan', c: '#6366F1' },
                { n: '4', l: 'Feasibility tiers', c: '#FB7185' },
                { n: '< 2s', l: 'Plan generation', c: '#F59E0B' },
                { n: '0', l: 'Credit card required', c: '#34D399' },
              ].map(({ n, l, c }) => (
                <div key={l} className="text-center">
                  <div
                    className="text-4xl md:text-6xl font-black tracking-tight mb-2"
                    style={{ color: c }}
                  >
                    {n}
                  </div>
                  <div className="text-xs md:text-sm font-medium text-white/50 tracking-wide">{l}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─────────────────── FAQ ─────────────────── */}
        <section id="faq" className="px-6 py-24 border-t border-white/[0.06]">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-14">
              <div className="inline-block text-xs font-bold text-[#34D399] tracking-[0.2em] uppercase mb-4">Questions</div>
              <h2 className="text-3xl md:text-5xl font-black tracking-tight text-white leading-tight">Still wondering?</h2>
            </div>
            <div className="space-y-3">
              {[
                {
                  q: 'Is this an AI model writing my schedule?',
                  a: 'No — and that\'s a feature. PrepVeda uses a deterministic constraint solver. Given the same inputs, it produces the same plan every time. No hallucinations, no random rewrites.',
                },
                {
                  q: 'Does it work for my specific exam?',
                  a: 'PrepVeda is exam-agnostic. If you can break your prep into subjects and chapters with effort estimates, it works — whether that\'s a board exam, competitive entrance test, professional certification or a semester final.',
                },
                {
                  q: 'What happens when I fall behind or miss a day?',
                  a: 'Re-run the planner in Intake mode. You can "keep previous plan" to minimise disruption, or let it re-optimise around what\'s left. Feasibility re-checks immediately.',
                },
                {
                  q: 'Can I edit a generated schedule by hand?',
                  a: 'Yes. Drag tasks across days in the Schedule view, mark things complete, or add ad-hoc sessions. Manual edits don\'t break the plan.',
                },
                {
                  q: 'Is my data safe?',
                  a: 'Your data lives in a Supabase Postgres database with row-level security — only you can read or write your plans. We don\'t train anything on your data.',
                },
                {
                  q: 'Is there a free plan?',
                  a: 'Yes. The free plan includes full planner access, subjects, calendar and schedule. No card required to start.',
                },
              ].map(({ q, a }, i) => (
                <details
                  key={i}
                  className="group rounded-2xl border border-white/[0.08] bg-[#0F1219] overflow-hidden"
                >
                  <summary className="list-none flex items-center justify-between gap-4 cursor-pointer px-6 py-5 hover:bg-white/[0.02] transition-colors">
                    <span className="text-base md:text-lg font-bold text-white pr-4">{q}</span>
                    <div className="w-8 h-8 shrink-0 rounded-full border border-white/10 bg-white/[0.03] flex items-center justify-center group-open:rotate-45 transition-transform">
                      <span className="text-white/60 text-lg leading-none">+</span>
                    </div>
                  </summary>
                  <div className="px-6 pb-6 text-sm md:text-base text-white/60 leading-relaxed">{a}</div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ─────────────────── FINAL CTA ─────────────────── */}
        <section className="px-6 py-24">
          <div className="max-w-5xl mx-auto rounded-[2.5rem] bg-gradient-to-br from-[#12151E] via-[#0F1219] to-[#12151E] border border-white/10 px-8 py-20 md:py-24 text-center relative overflow-hidden shadow-[0_40px_100px_-20px_rgba(0,0,0,0.9)]">
            <div className="absolute -top-32 -right-32 w-96 h-96 bg-[#6366F1] rounded-full blur-[120px] opacity-40" />
            <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-[#FB7185] rounded-full blur-[110px] opacity-30" />
            <div
              className="absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)',
                backgroundSize: '48px 48px',
              }}
            />

            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.06] border border-white/10 mb-8">
                <Sparkles className="w-4 h-4 text-[#FB7185]" />
                <span className="text-xs font-bold text-white/80 tracking-wider uppercase">Ready when you are</span>
              </div>

              <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-6 text-white leading-[1.05]">
                Stop guessing. <br className="md:hidden" />
                Start <span className="text-[#FB7185]">scheduling.</span>
              </h2>
              <p className="text-lg md:text-xl text-white/60 mb-10 max-w-2xl mx-auto font-medium">
                Build your first feasibility-checked plan in under 5 minutes.
              </p>
              <Link
                href="/auth/login"
                className="group inline-flex px-10 py-5 bg-white text-[#07080F] hover:bg-[#F0F2F5] rounded-full font-bold text-lg transition-all shadow-[0_0_50px_rgba(255,255,255,0.25)] items-center gap-3 hover:-translate-y-1"
              >
                Create your plan
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <div className="mt-6 text-xs text-white/40 font-medium">No credit card · Free plan forever</div>
            </div>
          </div>
        </section>

        {/* ─────────────────── FOOTER ─────────────────── */}
        <footer className="border-t border-white/[0.06] py-12 px-6 bg-[#05060B]">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#12151E] flex items-center justify-center p-1 border border-white/10">
                <Image src="/logo.png" alt="PrepVeda" width={20} height={20} className="object-contain" />
              </div>
              <span className="font-bold text-white">PrepVeda</span>
            </div>
            <div className="text-sm font-medium text-white/40">&copy; {new Date().getFullYear()} PrepVeda · All rights reserved.</div>
            <div className="flex gap-6 text-sm font-semibold">
              <Link href="#" className="text-white/50 hover:text-white transition-colors">Privacy</Link>
              <Link href="#" className="text-white/50 hover:text-white transition-colors">Terms</Link>
              <Link href="#" className="text-white/50 hover:text-white transition-colors">Contact</Link>
            </div>
          </div>
        </footer>
      </main>

      {/* ─────────────────── Float animations ─────────────────── */}
      <style>{`
        @keyframes float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-10px) } }
        @keyframes float-slow { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-14px) } }
        @keyframes float-delay { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }
        .animate-float { animation: float 5s ease-in-out infinite }
        .animate-float-slow { animation: float-slow 7s ease-in-out infinite }
        .animate-float-delay { animation: float-delay 6s ease-in-out infinite 1s }
        .perspective-1000 { perspective: 1000px }
      `}</style>
    </div>
  );
}

/* ─────────────────── FEATURE BLOCK COMPONENT ─────────────────── */
function FeatureBlock({
  reverse,
  index,
  eyebrow,
  title,
  body,
  img,
  accent,
  stickers,
  bullets,
}: {
  reverse: boolean;
  index: string;
  eyebrow: string;
  title: React.ReactNode;
  body: string;
  img: string;
  accent: string;
  stickers: { icon: React.ComponentType<{ className?: string }>; label: string; pos: string; tint: string }[];
  bullets: { icon: React.ComponentType<{ className?: string }>; text: string }[];
}) {
  return (
    <div className="grid md:grid-cols-2 gap-10 lg:gap-20 items-center">
      <div className={`relative ${reverse ? 'md:order-2' : ''}`}>
        {/* Offset decorative panel */}
        <div
          className={`absolute -inset-3 rounded-[2rem] border border-white/[0.06] ${reverse ? '-rotate-2' : 'rotate-2'} -z-10`}
          style={{ background: `linear-gradient(135deg, ${accent}10, transparent 60%)` }}
        />
        <div className="relative rounded-[1.5rem] overflow-hidden border border-white/10 bg-[#07080F] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]">
          <Image src={img} alt={eyebrow} width={1400} height={900} className="w-full" />
        </div>
        {/* Floating stickers */}
        {stickers.map(({ icon: SIcon, label, pos, tint }) => (
          <div
            key={label}
            className={`absolute ${pos} hidden md:flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-[#12151E]/95 backdrop-blur-md border border-white/10 shadow-xl animate-float`}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: `${tint}1A` }}
            >
              <SIcon className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-bold text-white whitespace-nowrap">{label}</span>
          </div>
        ))}
      </div>

      <div className={reverse ? 'md:order-1' : ''}>
        <div className="flex items-center gap-3 mb-5">
          <div
            className="px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase border"
            style={{ color: accent, borderColor: `${accent}40`, background: `${accent}10` }}
          >
            {index} · {eyebrow}
          </div>
        </div>
        <h3 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight text-white leading-[1.1] mb-5">
          {title}
        </h3>
        <p className="text-base md:text-lg text-white/60 leading-relaxed mb-7 font-medium">{body}</p>
        <ul className="space-y-3">
          {bullets.map(({ icon: BIcon, text }) => (
            <li key={text} className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border"
                style={{ background: `${accent}12`, borderColor: `${accent}25` }}
              >
                <BIcon className="w-4 h-4" />
              </div>
              <span className="text-sm md:text-base text-white/80 font-medium">{text}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
