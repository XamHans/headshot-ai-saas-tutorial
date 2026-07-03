'use client';

import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  ArrowUpRight,
  Bot,
  Braces,
  Check,
  Database,
  Image as ImageIcon,
  Layout,
  Mail,
  MonitorSpeaker,
  Rocket,
  Server,
  Shield,
  Sparkles,
  Star,
  Target,
  TestTube,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Cover } from '@/components/ui/cover';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Separator } from '@/components/ui/separator';

type TechCategory = {
  id: string;
  label: string;
  summary: string;
  icon: LucideIcon;
  heading: string;
  description: string;
  bullets: string[];
  timeSaved: string;
  accent: string;
  integrations: { name: string; href: string }[];
};

const techCategories: TechCategory[] = [
  {
    id: 'auth',
    label: 'Login',
    summary: 'Magic links, OAuth, sessions',
    icon: Shield,
    heading: 'User authentication, sorted.',
    description:
      'Better Auth handles secure login flows, session management, and database wiring so your users stay safe by default.',
    bullets: [
      'Email and OAuth providers configured with Better Auth from day one.',
      'Session, account, and verification tables managed through Drizzle migrations.',
      'Route protection middleware and typed helpers connected to the App Router.',
    ],
    timeSaved: 'Time saved: 6+ hours of manual setup',
    accent: 'text-emerald-400',
    integrations: [
      { name: 'Better Auth', href: 'https://better-auth.com' },
      { name: 'Drizzle ORM', href: 'https://orm.drizzle.team' },
    ],
  },
  {
    id: 'ai',
    label: 'AI',
    summary: 'Multi-model, streaming UI',
    icon: Bot,
    heading: 'Production AI flows that scale.',
    description:
      'Experiment fast with text and chat playgrounds, then ship with confidence thanks to spec-driven prompts and real observability.',
    bullets: [
      'Vercel AI SDK prewired with OpenAI, Anthropic, and Google providers.',
      'Streaming chat and text playgrounds ready for product-grade experiences.',
      'Claude Code MCP keeps specs, code, and infrastructure in sync for agents.',
    ],
    timeSaved: 'Time saved: 2 days of integration work',
    accent: 'text-purple-400',
    integrations: [
      { name: 'Vercel AI SDK', href: 'https://sdk.vercel.ai' },
      { name: 'Claude Code MCP', href: 'https://claude.ai/code' },
    ],
  },
  {
    id: 'data',
    label: 'Database',
    summary: 'Neon, Drizzle, LibSQL ready',
    icon: Database,
    heading: 'A reliable data foundation.',
    description:
      'Type-safe queries, migrations, and environment-ready configs for both Postgres and edge-friendly SQL backends.',
    bullets: [
      'Drizzle migrations, seeds, and typed queries baked into the repo.',
      'Neon, LibSQL, and local SQLite connections configured for dev and prod.',
      'Test schema isolation ensures clean CI runs without side effects.',
    ],
    timeSaved: 'Time saved: 1 day of database wiring',
    accent: 'text-sky-400',
    integrations: [
      { name: 'Neon', href: 'https://neon.tech' },
      { name: 'LibSQL', href: 'https://libsql.org' },
      { name: 'Drizzle ORM', href: 'https://orm.drizzle.team' },
    ],
  },
  {
    id: 'email',
    label: 'Emails',
    summary: 'Transactional ready to go',
    icon: Mail,
    heading: 'Email delivery without the headaches.',
    description:
      'Send onboarding, password reset, and product notifications with a polished template system tied straight into your auth flows.',
    bullets: [
      'Resend configured with API keys, domain setup docs, and env management.',
      'Prebuilt React Email templates with Tailwind styles and dark-mode support.',
      'Background job pattern ready for queued sends and delivery monitoring.',
    ],
    timeSaved: 'Time saved: 6 hours of email plumbing',
    accent: 'text-amber-300',
    integrations: [
      { name: 'Resend', href: 'https://resend.com' },
      { name: 'React Email', href: 'https://react.email' },
    ],
  },
  {
    id: 'observability',
    label: 'Insights',
    summary: 'Logs, traces, analytics',
    icon: MonitorSpeaker,
    heading: 'Observability from day one.',
    description:
      'Know what every AI agent and API call is doing with telemetry and alerting wired up before you deploy.',
    bullets: [
      'Langfuse instrumentation wraps every AI call with trace metadata.',
      'Pino logging outputs structured JSON events for your pipelines.',
      'Umami analytics integration gives privacy-friendly product insights.',
    ],
    timeSaved: 'Time saved: 3 hours of telemetry plumbing',
    accent: 'text-blue-300',
    integrations: [
      { name: 'Langfuse', href: 'https://langfuse.com' },
      { name: 'Pino', href: 'https://getpino.io' },
      { name: 'Umami', href: 'https://umami.is' },
    ],
  },
  {
    id: 'quality',
    label: 'Quality',
    summary: 'Specs, tests, CI ready',
    icon: TestTube,
    heading: 'Quality gates baked into the template.',
    description:
      'Ship confidently with a spec-driven workflow, strong tests, and ready-made CI scripts your team can trust.',
    bullets: [
      'Gherkin specs turn product requirements into executable acceptance tests.',
      'Vitest unit and integration harness with realistic mocks ready to extend.',
      'Playwright and Supertest suites preconfigured for end-to-end coverage.',
    ],
    timeSaved: 'Time saved: 2 days of QA setup',
    accent: 'text-pink-400',
    integrations: [
      { name: 'Gherkin Specs', href: 'https://cucumber.io/docs/gherkin/' },
      { name: 'Vitest', href: 'https://vitest.dev' },
      { name: 'Playwright', href: 'https://playwright.dev' },
    ],
  },
];

export default function LandingPage() {
  const [activeCategory, setActiveCategory] = useState(techCategories[0]?.id ?? 'auth');
  const activeHighlight =
    techCategories.find((category) => category.id === activeCategory) ?? techCategories[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Column - Text Content */}
            <motion.div
              className="space-y-8"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold relative z-20 bg-clip-text text-transparent bg-gradient-to-b from-neutral-800 via-neutral-700 to-neutral-700 dark:from-neutral-800 dark:via-white dark:to-white">
                Ship{' '}
                <HoverCard>
                  <HoverCardTrigger>
                    <Cover>AI SaaS</Cover>
                  </HoverCardTrigger>
                  <HoverCardContent className="w-80">
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold">Professional AI SaaS</h4>
                      <p className="text-sm text-muted-foreground">
                        Building AI-powered Software as a Service applications with enterprise-grade
                        architecture, proper testing, and maintainable code that scales with your
                        business.
                      </p>
                    </div>
                  </HoverCardContent>
                </HoverCard>{' '}
                That Last.
                <br />
                Not just vibe-driven demos.
              </h1>
              <p className="text-xl leading-8 text-muted-foreground">
                Build a full-stack AI SaaS with production-grade architecture, batteries-included
                tooling, and clear docs that keep your team aligned from prototype to launch.
              </p>
              <div className="space-y-4">
                <ul className="grid gap-3 text-base text-muted-foreground">
                  <li className="flex items-start gap-3">
                    <span className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Check className="h-4 w-4" />
                    </span>
                    <span>
                      End-to-end scaffolding for auth, billing, observability, and testing.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Check className="h-4 w-4" />
                    </span>
                    <span>
                      Spec-driven workflows so every feature ships with clarity and confidence.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Check className="h-4 w-4" />
                    </span>
                    <span>
                      Battle-tested integrations for major AI providers and modern databases.
                    </span>
                  </li>
                </ul>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <Button asChild size="lg" className="h-14 px-8 text-lg">
                    <Link
                      href="https://github.com/XamHans/fullstack-ai-starter"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open on GitHub
                      <Rocket className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="h-14 px-8 text-lg">
                    <Link
                      href="https://github.com/XamHans/fullstack-ai-starter?tab=readme-ov-file#quick-start"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Clone & Quickstart Guide
                    </Link>
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Clone the repo then follow the Quick Start section in the README for the fastest
                  setup path.
                </p>
              </div>
            </motion.div>

            {/* Right Column - Hero Visual */}
            <motion.div
              className="relative order-first lg:order-last"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <div className="relative">
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 rounded-3xl blur-3xl"
                  animate={{
                    scale: [1, 1.05, 1],
                    rotate: [0, 1, 0],
                  }}
                  transition={{
                    duration: 6,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />
                <motion.div
                  whileHover={{ scale: 1.02, rotate: 1 }}
                  transition={{ duration: 0.3 }}
                  className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-background shadow-2xl dark:border-neutral-800"
                >
                  <div className="grid min-h-[360px] grid-cols-2 gap-px bg-border">
                    {[
                      { label: 'Specs', icon: Braces },
                      { label: 'Routes', icon: Server },
                      { label: 'Database', icon: Database },
                      { label: 'Tests', icon: TestTube },
                    ].map((item) => {
                      const Icon = item.icon;

                      return (
                        <div
                          key={item.label}
                          className="flex flex-col items-center justify-center gap-3 bg-background p-8"
                        >
                          <Icon className="h-10 w-10 text-primary" />
                          <span className="text-sm font-medium text-muted-foreground">
                            {item.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 to-transparent p-8">
                    <div className="rounded-lg border bg-background/90 p-4 shadow-sm backdrop-blur">
                      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Production-ready AI stack
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Next.js, Drizzle, Better Auth, TanStack Query, AI SDK, and Vitest wired
                        together for real product work.
                      </p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Development Approaches Comparison */}
      <section className="relative overflow-hidden py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
                The Two Paths of AI-Assisted Development
              </h2>
              <p className="text-lg text-muted-foreground">
                Choose the foundation that will support your business, not just your demo.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              viewport={{ once: true }}
              className="grid md:grid-cols-2 gap-8 relative"
            >
              {/* Vibe-Driven Problems */}
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="border-border bg-muted/20">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <X className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-lg font-semibold text-foreground">
                        The "Vibe-Driven" Trap
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3 text-sm">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>Hours</strong> spent debugging inconsistent, AI-generated code.
                        </span>
                      </div>
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>Days</strong> lost fixing features when AI creates conflicting
                          implementations.
                        </span>
                      </div>
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>Weeks</strong> refactoring "spaghetti code" that lacks a coherent
                          structure.
                        </span>
                      </div>
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>Months</strong> wrestling with untestable and unmaintainable
                          legacy code.
                        </span>
                      </div>
                    </div>
                    <Separator className="bg-border" />
                    <Alert className="border-border bg-muted/30">
                      <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                      <AlertDescription className="text-foreground font-semibold">
                        Result: Crippling Maintenance Overhead
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Vertical Separator */}
              <Separator
                orientation="vertical"
                className="absolute left-1/2 top-8 bottom-8 transform -translate-x-1/2 hidden md:block bg-border"
              />

              {/* Spec-Driven Advantages */}
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                viewport={{ once: true }}
              >
                <Card className="border-border bg-background">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-foreground" />
                      <CardTitle className="text-lg font-semibold text-foreground">
                        The Spec-Driven Advantage
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3 text-sm">
                      <div className="flex items-start gap-3">
                        <Target className="h-4 w-4 text-foreground mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>BDD workflows:</strong> Define specs once, AI implements perfectly
                          every time.
                        </span>
                      </div>
                      <div className="flex items-start gap-3">
                        <Wrench className="h-4 w-4 text-foreground mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>Dependency injection:</strong> Clean, testable, and scalable
                          architecture.
                        </span>
                      </div>
                      <div className="flex items-start gap-3">
                        <TestTube className="h-4 w-4 text-foreground mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>Vitest testing:</strong> Catch issues before they reach
                          production.
                        </span>
                      </div>
                      <div className="flex items-start gap-3">
                        <Bot className="h-4 w-4 text-foreground mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>Claude Code MCP:</strong> Context-aware AI with full codebase
                          understanding.
                        </span>
                      </div>
                    </div>
                    <Separator className="bg-border" />
                    <Alert className="border-border bg-muted/30">
                      <Rocket className="h-4 w-4 text-foreground" />
                      <AlertDescription className="text-foreground font-semibold">
                        Result: Zero Maintenance Overhead
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              viewport={{ once: true }}
              className="mt-12 text-center"
            >
              <div className="text-2xl font-bold mb-4">There's a smarter way to build.</div>
              <div className="text-lg text-muted-foreground">
                Stop building fragile apps. Start building bulletproof businesses.
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Tech Stack & Benefits Section */}
      <motion.section
        className="relative overflow-hidden py-24 sm:py-32"
        initial={{ opacity: 0, y: 80 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        viewport={{ once: true, amount: 0.2 }}
      >
        <div className="mx-auto max-w-6xl px-6 lg:px-8">
          <motion.div layout className="relative">
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 1.2, delay: 0.2 }}
              viewport={{ once: true }}
            >
              <motion.div
                className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl"
                animate={{ scale: [1, 1.1, 1], opacity: [0.4, 0.6, 0.4] }}
                transition={{ duration: 10, repeat: Infinity }}
              />
              <motion.div
                className="absolute -bottom-16 right-8 h-64 w-64 rounded-full bg-purple-500/10 blur-3xl"
                animate={{ scale: [1, 0.95, 1.05, 1], opacity: [0.35, 0.5, 0.35, 0.4] }}
                transition={{ duration: 12, repeat: Infinity }}
              />
            </motion.div>

            <div className="relative overflow-hidden rounded-3xl border border-neutral-200/30 bg-neutral-950 text-neutral-100 shadow-2xl dark:border-neutral-800">
              <div className="border-b border-white/5 px-8 py-10 sm:px-10">
                <code className="inline rounded-full bg-white/5 px-4 py-2 font-mono text-xs tracking-tight text-emerald-400">
                  const launch_time = "05:01 PM";
                </code>
                <motion.h3
                  className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  viewport={{ once: true }}
                >
                  Supercharge your app instantly.
                  <br className="hidden sm:block" />
                  Launch faster, make revenue sooner.
                </motion.h3>
                <motion.p
                  className="mt-4 max-w-3xl text-base text-neutral-300 sm:text-lg"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  viewport={{ once: true }}
                >
                  Login users, run AI workloads, ship reliable features without wiring every
                  integration by hand. Pick a capability to see what ships for you.
                </motion.p>
              </div>

              <div className="flex flex-col gap-8 px-6 py-10 sm:px-10 md:flex-row md:gap-12">
                <div className="md:w-1/3">
                  <div className="flex flex-row flex-wrap gap-3 md:flex-col">
                    {techCategories.map((category) => {
                      const Icon = category.icon;
                      const isActive = category.id === activeCategory;
                      return (
                        <motion.button
                          key={category.id}
                          type="button"
                          className={`group flex min-w-[150px] flex-1 items-center gap-3 rounded-2xl border px-4 py-3 text-left md:w-full ${
                            isActive
                              ? 'border-white/40 bg-white/10 text-white'
                              : 'border-white/10 text-white/60 hover:border-white/25 hover:text-white'
                          }`}
                          onClick={() => setActiveCategory(category.id)}
                          whileHover={{ scale: 1.02, y: -4 }}
                          whileTap={{ scale: 0.98 }}
                          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                        >
                          <motion.span
                            className={`flex h-12 w-12 items-center justify-center rounded-xl border ${
                              isActive
                                ? 'border-white bg-white text-neutral-900'
                                : 'border-white/10 bg-white/5 text-white/80 group-hover:border-white/30 group-hover:text-white'
                            }`}
                            layout
                            transition={{ type: 'spring', stiffness: 280, damping: 18 }}
                          >
                            <Icon
                              className={`h-5 w-5 ${isActive ? 'text-neutral-900' : category.accent}`}
                            />
                          </motion.span>
                          <div className="space-y-1">
                            <div className="text-sm font-semibold uppercase tracking-wide">
                              {category.label}
                            </div>
                            <div className="text-xs text-white/60">{category.summary}</div>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                <div className="md:flex-1">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeHighlight.id}
                      className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      transition={{ duration: 0.35, ease: 'easeOut' }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono uppercase tracking-[0.2em] text-white/50">
                          Capability spotlight
                        </span>
                        <Separator className="h-5 w-px bg-white/10" orientation="vertical" />
                        <span className="text-xs text-white/60">
                          Selected • {activeHighlight.label}
                        </span>
                      </div>
                      <h4 className="mt-6 text-2xl font-semibold sm:text-3xl">
                        {activeHighlight.heading}
                      </h4>
                      <p className="mt-3 text-base text-neutral-300">
                        {activeHighlight.description}
                      </p>
                      <ul className="mt-6 space-y-3 text-sm sm:text-base">
                        {activeHighlight.bullets.map((point) => (
                          <motion.li
                            key={point}
                            className="flex items-start gap-3"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3, ease: 'easeOut' }}
                          >
                            <Check
                              className={`mt-1 h-5 w-5 flex-shrink-0 ${activeHighlight.accent}`}
                            />
                            <span className="text-neutral-100">{point}</span>
                          </motion.li>
                        ))}
                      </ul>
                      <div className="mt-6 flex items-center gap-2 text-sm font-semibold">
                        <Check className={`h-4 w-4 ${activeHighlight.accent}`} />
                        <span className={activeHighlight.accent}>{activeHighlight.timeSaved}</span>
                      </div>
                      <div className="mt-6">
                        <p className="text-xs uppercase tracking-wide text-white/60">Works with</p>
                        <motion.div
                          className="mt-3 flex flex-wrap gap-2"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.3, delay: 0.1 }}
                        >
                          {activeHighlight.integrations.map((integration) => (
                            <Link
                              key={integration.name}
                              href={integration.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/70 transition hover:border-white/30 hover:text-white"
                            >
                              {integration.name}
                            </Link>
                          ))}
                        </motion.div>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

              <div className="flex flex-col gap-4 border-t border-white/5 bg-black/40 px-8 py-6 sm:px-10 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-white/70">
                  Clone the repo and follow the Quick Start in the README to activate every module
                  in minutes.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    asChild
                    size="sm"
                    className="h-10 px-5 text-sm font-semibold text-neutral-900"
                  >
                    <Link
                      href="https://github.com/XamHans/fullstack-ai-starter"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open GitHub
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="sm"
                    variant="secondary"
                    className="h-10 px-5 text-sm font-semibold"
                  >
                    <Link
                      href="https://github.com/XamHans/fullstack-ai-starter?tab=readme-ov-file#quick-start"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Quick Start Guide
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* AI Services Section */}
      <motion.section
        className="relative overflow-hidden py-24 sm:py-32"
        initial={{ opacity: 0, y: 80 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        viewport={{ once: true, amount: 0.3 }}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute left-1/2 top-1/4 h-72 w-72 -translate-x-1/2 rounded-full bg-indigo-500/10 blur-3xl"
            animate={{ scale: [1, 1.08, 1], opacity: [0.35, 0.55, 0.35] }}
            transition={{ duration: 12, repeat: Infinity }}
          />
          <motion.div
            className="absolute -bottom-16 right-10 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl"
            animate={{ scale: [1, 0.95, 1.05, 1], opacity: [0.3, 0.45, 0.3, 0.35] }}
            transition={{ duration: 10, repeat: Infinity }}
          />
        </div>
        <div className="relative mx-auto flex max-w-6xl flex-col gap-12 px-6 lg:px-8">
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            viewport={{ once: true }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-primary">
              AI Services
            </span>
            <h2 className="mt-6 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              Built on Vercel AI SDK with enterprise AI patterns baked in.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground sm:mx-auto sm:max-w-3xl">
              Stream results, enforce structured output, and generate imagery with Google Gemini’s
              Nano Banana model — all without leaving this starter kit.
            </p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                title: 'Multi-provider text & chat',
                description:
                  'Prebuilt playgrounds and endpoints for OpenAI, Anthropic, and Google models using Vercel AI SDK’s React bindings.',
                icon: Sparkles,
              },
              {
                title: 'Structured output, guaranteed',
                description:
                  'Define Zod schemas and receive typed responses automatically. No more brittle parsing when you need JSON your services can trust.',
                icon: Braces,
              },
              {
                title: 'Gemini Nano Banana visuals',
                description:
                  'Spin up image generation with Google’s Nano Banana diffusion model. Produce marketing visuals and UI concepts directly from prompts.',
                icon: ImageIcon,
              },
            ].map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  className="group relative overflow-hidden rounded-2xl border border-border/60 bg-background/60 p-8 shadow-lg transition hover:border-primary/40 hover:shadow-primary/10"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.12 * index }}
                  viewport={{ once: true }}
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 transition group-hover:opacity-100"
                    initial={false}
                  />
                  <div className="relative">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                      <Icon className="h-6 w-6" />
                    </span>
                    <h3 className="mt-6 text-xl font-semibold text-foreground">{feature.title}</h3>
                    <p className="mt-3 text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <motion.div
            className="relative overflow-hidden rounded-3xl border border-border bg-background/80 p-10 shadow-xl"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.2 }}
            viewport={{ once: true }}
          >
            <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div className="space-y-4">
                <Badge variant="secondary" className="bg-primary/10 text-primary">
                  AI launchpad
                </Badge>
                <h3 className="text-2xl font-semibold text-foreground sm:text-3xl">
                  One command to run the playground, one spec to ship the feature.
                </h3>
                <p className="text-base text-muted-foreground">
                  The repo wires Vercel AI SDK handlers, streaming UI components, and Langfuse
                  telemetry. Describe your feature in Gherkin, feed it to Claude Code, and watch the
                  agent deploy the change with complete context.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button asChild size="sm">
                    <Link href="/playground/generate-text">Open AI Playground</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="gap-2">
                    <Link
                      href="https://github.com/XamHans/fullstack-ai-starter/tree/main/modules"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Explore specs & modules
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>

              <motion.div
                className="rounded-2xl border border-border/80 bg-background/90 p-6 font-mono text-xs text-muted-foreground shadow-inner"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.25 }}
                viewport={{ once: true }}
              >
                <p className="text-[10px] uppercase tracking-[0.3em] text-primary mb-4">
                  Example structured output call
                </p>
                <pre className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
                  {`const result = await streamText({
  model: google('gemini-1.5-pro'),
  prompt,
  output: z.object({
    summary: z.string(),
    actionItems: z.array(z.string()),
    heroVisual: z.string().url(), // generated via Nano Banana
  }),
});`}
                </pre>
                <p className="mt-4 text-xs text-muted-foreground/80">
                  The template handles streaming UI state, optimistic rendering, and Langfuse
                  tracing so you can focus on product experience.
                </p>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* Pricing Comparison Section */}
      <section className="relative overflow-hidden py-24 sm:py-32 bg-muted/30">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
              Get a Professional Architecture, Not Just a Boilerplate
            </h2>
            <p className="text-lg text-muted-foreground">
              Why pay for patterns that create technical debt? Get a production-ready foundation for
              free.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {/* Other Boilerplates */}
            <Card className="relative border-neutral-200 dark:border-neutral-800 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
              <div className="absolute top-4 right-4">
                <Badge variant="secondary" className="text-xs">
                  High Hidden Costs
                </Badge>
              </div>

              <CardHeader className="text-center pb-4">
                <CardTitle className="text-lg text-muted-foreground mb-3">
                  Other Boilerplates
                </CardTitle>
                <div className="relative">
                  <div className="text-5xl font-bold text-muted-foreground mb-2">$199-$299</div>
                </div>
                <CardDescription className="text-muted-foreground font-medium">
                  One-time payment • Endless refactoring
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-0">
                <div className="space-y-4">
                  <div className="bg-neutral-100/50 dark:bg-neutral-800/10 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      What you actually get:
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-start gap-2">
                        <X className="h-3 w-3 text-muted-foreground mt-1 flex-shrink-0" />
                        <span>Pre-configured services without a testing strategy.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <X className="h-3 w-3 text-muted-foreground mt-1 flex-shrink-0" />
                        <span>No production-grade logging or monitoring in place.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <X className="h-3 w-3 text-muted-foreground mt-1 flex-shrink-0" />
                        <span>Lacks modern agentic coding systems for AI.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <X className="h-3 w-3 text-muted-foreground mt-1 flex-shrink-0" />
                        <span>Maintenance overhead that accumulates from day one.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <X className="h-3 w-3 text-muted-foreground mt-1 flex-shrink-0" />
                        <span>A major refactor is required before you can truly scale.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Our Spec-Driven Kit */}
            <Card className="relative bg-background border-2 border-primary shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                <Badge className="bg-primary text-primary-foreground px-6 py-2 text-sm font-bold shadow-lg">
                  <Star className="w-4 h-4 mr-2" />
                  PROFESSIONAL GRADE
                </Badge>
              </div>

              <CardHeader className="text-center pt-10 pb-6">
                <CardTitle className="text-xl text-primary mb-3">Spec-Driven Starter Kit</CardTitle>
                <div className="relative">
                  <div className="text-6xl font-bold text-primary mb-2">FREE</div>
                  <div className="text-sm text-primary font-medium">
                    Open source forever • No hidden costs
                  </div>
                </div>
                <CardDescription className="text-lg font-medium">
                  Save $299 + months of development time
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-0">
                <div className="space-y-4">
                  <div className="bg-neutral-100/50 dark:bg-neutral-800/10 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Rocket className="h-4 w-4" />
                      What you actually get:
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-start gap-2">
                        <Check className="h-3 w-3 text-primary mt-1 flex-shrink-0" />
                        <span className="font-medium">
                          A spec-driven architecture that scales seamlessly.
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Check className="h-3 w-3 text-primary mt-1 flex-shrink-0" />
                        <span className="font-medium">
                          A complete test-driven development methodology.
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Check className="h-3 w-3 text-primary mt-1 flex-shrink-0" />
                        <span className="font-medium">
                          Production-grade logging and monitoring.
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Check className="h-3 w-3 text-primary mt-1 flex-shrink-0" />
                        <span className="font-medium">
                          Agentic coding systems for perfect AI context.
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Check className="h-3 w-3 text-primary mt-1 flex-shrink-0" />
                        <span className="font-medium">Zero maintenance overhead, by design.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Check className="h-3 w-3 text-primary mt-1 flex-shrink-0" />
                        <span className="font-medium">Production-ready from day one.</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6">
                    <Button
                      asChild
                      className="w-full h-14 text-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all duration-300"
                    >
                      <Link href="/playground/generate-text">
                        Start Building for Free
                        <Rocket className="ml-2 h-6 w-6" />
                      </Link>
                    </Button>
                    <p className="text-center text-xs text-muted-foreground mt-2">
                      No credit card required • Available immediately
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-lg text-muted-foreground">
              Everything you need to know about building a real business with AI.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
          >
            <Accordion type="single" collapsible className="space-y-4" defaultValue="item-1">
              <AccordionItem value="item-1" className="border rounded-lg px-6">
                <AccordionTrigger className="text-left">
                  How is this different from other boilerplates?
                </AccordionTrigger>
                <AccordionContent>
                  Most boilerplates simply hand you a set of tools. We give you a methodology. Our
                  foundation is domain-driven modules with dependency injection, so your business
                  logic stays testable and independent. On top of that, Claude Code brings context
                  awareness—direct access to your database, logs, and even deployments—so AI works
                  with your actual system, not in isolation. Finally, our spec-driven workflow turns
                  requirements into Gherkin specs, which become tests, then implementations. This
                  guarantees that every feature is consistent, verifiable, and aligned with your
                  specs from day one.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-2" className="border rounded-lg px-6">
                <AccordionTrigger className="text-left">
                  How does the modular architecture scale?
                </AccordionTrigger>
                <AccordionContent>
                  The domain-driven modular architecture organizes business logic into separate
                  modules (users, posts, etc.). Each module has its own service layer, schema, and
                  types. This approach allows teams to work independently on different features
                  without conflicts, makes testing easier through isolation, and enables horizontal
                  scaling as your business grows.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-3" className="border rounded-lg px-6">
                <AccordionTrigger className="text-left">
                  What makes this "spec-driven" development?
                </AccordionTrigger>
                <AccordionContent>
                  Instead of writing code directly, you first define requirements using Gherkin
                  specifications. These clear, human-readable specs guide AI implementation,
                  ensuring consistency across features. When you need to add functionality, you
                  write the specification first, then use AI tools to implement it exactly according
                  to your documented requirements.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-4" className="border rounded-lg px-6">
                <AccordionTrigger className="text-left">
                  How do you handle email delivery and templates?
                </AccordionTrigger>
                <AccordionContent>
                  We integrate with Resend for professional email delivery. This includes
                  transactional emails, marketing campaigns, and automated workflows. Resend
                  provides excellent deliverability rates, built-in analytics, and a
                  developer-friendly API. Email templates are managed through their dashboard or
                  programmatically through their React Email integration.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-5" className="border rounded-lg px-6">
                <AccordionTrigger className="text-left">
                  Can multiple developers work on this effectively?
                </AccordionTrigger>
                <AccordionContent>
                  Absolutely. The dependency injection pattern and modular architecture enable team
                  collaboration. Developers can work on different modules simultaneously without
                  conflicts. The service layer abstracts business logic, making it easy to mock
                  dependencies for testing. Clear specifications prevent miscommunication about
                  requirements.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-6" className="border rounded-lg px-6">
                <AccordionTrigger className="text-left">
                  Is there comprehensive documentation?
                </AccordionTrigger>
                <AccordionContent>
                  Yes! Full documentation is available covering architecture patterns, API design,
                  database strategies, testing approaches, and deployment guides. Each major
                  component has detailed guides with examples, best practices, and troubleshooting
                  tips. The documentation is continuously updated with new patterns and learnings.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-7" className="border rounded-lg px-6">
                <AccordionTrigger className="text-left">
                  How do you manage AI costs in production?
                </AccordionTrigger>
                <AccordionContent>
                  The AI SDK supports multiple providers (OpenAI, Anthropic, Google AI), allowing
                  you to switch based on cost and performance. Built-in telemetry tracks usage and
                  costs per operation. You can implement rate limiting, caching for common requests,
                  and use smaller models for development. The observability stack helps identify
                  expensive operations for optimization.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-8" className="border rounded-lg px-6">
                <AccordionTrigger className="text-left">
                  What's the database strategy for scaling?
                </AccordionTrigger>
                <AccordionContent>
                  Neon provides serverless PostgreSQL with database branching for safe development.
                  Each feature branch can have its own database branch. The connection pooling and
                  auto-scaling handle traffic spikes automatically. Drizzle ORM provides type-safe
                  queries and migration management. The modular service layer makes it easy to
                  optimize queries per domain.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-9" className="border rounded-lg px-6">
                <AccordionTrigger className="text-left">
                  How do you handle file uploads securely?
                </AccordionTrigger>
                <AccordionContent>
                  Uppy 5.0 provides comprehensive file validation including MIME type checking, file
                  size limits, extension filtering, and malware detection patterns. Files are
                  uploaded to Cloudflare R2 with secure filename generation to prevent path
                  traversal attacks. The validation layer blocks dangerous file types and provides
                  detailed error messages for rejected uploads.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-10" className="border rounded-lg px-6">
                <AccordionTrigger className="text-left">
                  What testing approach ensures code quality?
                </AccordionTrigger>
                <AccordionContent>
                  A multi-layer testing strategy using Vitest for unit/integration tests, Supertest
                  for API testing, and Playwright for end-to-end testing. The dependency injection
                  pattern makes services easy to test in isolation. Gherkin specifications help
                  ensure tests match requirements. Test containers provide real PostgreSQL for
                  integration testing while maintaining speed.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-11" className="border rounded-lg px-6">
                <AccordionTrigger className="text-left">
                  How does authentication work across the stack?
                </AccordionTrigger>
                <AccordionContent>
                  Better-auth provides production-ready authentication with email/password and OAuth
                  providers. Session management is handled automatically with secure cookies. API
                  routes use higher-order functions for authentication checking. The system is
                  tested against 100+ edge cases including session hijacking, CSRF attacks, and
                  account enumeration.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-12" className="border rounded-lg px-6">
                <AccordionTrigger className="text-left">
                  What's the deployment and monitoring strategy?
                </AccordionTrigger>
                <AccordionContent>
                  Vercel provides zero-config deployments with automatic scaling and global CDN.
                  Langfuse tracks AI operations with comprehensive telemetry including costs,
                  performance, and error rates. Structured logging with Pino provides detailed
                  debugging information. Umami analytics gives privacy-focused insights into user
                  behavior without tracking personal data.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </motion.div>
        </div>
      </section>

      {/* Founder Story Section */}
      <section className="mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8 bg-muted/30">
        <div className="mx-auto max-w-4xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <div className="mx-auto mt-8">
                <div className="grid min-h-[420px] place-items-center rounded-xl border bg-background p-8 shadow-lg">
                  <div className="space-y-6 text-center">
                    <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-primary/10">
                      <Users className="h-9 w-9 text-primary" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-lg font-semibold">Built from real project pain</p>
                      <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                        A starter kit shaped by the work of turning AI-assisted prototypes into
                        maintainable production systems.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
              className="space-y-6"
            >
              <div>
                <Badge variant="secondary" className="mb-4">
                  <Users className="w-3 h-3 mr-1" />
                  From Developer, For Developers
                </Badge>
                <h2 className="text-3xl font-bold tracking-tight mb-4">
                  I got tired of "vibe-driven" development.
                </h2>
              </div>

              <div className="space-y-4 text-muted-foreground">
                <p>
                  AI-generated code without proper instruction and leading can harm more than
                  benefit. After suffering through this myself and drawing from my background in
                  software engineering, I realized we needed a better approach.
                </p>
                <p>
                  The challenge isn't AI itself—it's how we guide and structure its output. Without
                  clear specifications and architectural guidelines, AI creates beautiful code that
                  becomes a maintenance nightmare.
                </p>
                <p>
                  That's why I came up with this starter kit—to find a better way to use modern
                  agentic coding systems. It provides the foundation to build real, scalable
                  businesses with AI, not just fragile demos.
                </p>
              </div>

              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Join me in building the next generation of AI software—the right way. Your future
                  self will thank you when you're scaling effortlessly while others are drowning in
                  maintenance.
                </div>

                <div className="pt-4 border-t border-border">
                  <p className="text-sm font-medium mb-3">
                    Thanks -{' '}
                    <Link
                      href="https://www.linkedin.com/in/johannes-hayer-b8253a294/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold hover:text-primary transition-colors text-blue-800"
                    >
                      Johannes
                    </Link>
                  </p>
                  <p className="text-sm text-muted-foreground mb-3">
                    If you have questions, join our community of AI Builders
                  </p>
                  <Button asChild variant="outline" size="sm">
                    <Link
                      href="https://www.skool.com/ai-builders-6997/about?ref=873c5678d6d845feba1c23c6dbccdce3"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2"
                    >
                      Join AI Builders Community
                      <Users className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}
