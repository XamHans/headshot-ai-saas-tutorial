'use client';

import { Camera, Check, Download, Shield, Sparkles, Star, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { Suspense } from 'react';
import { OnboardingFlow } from '@/app/(main)/headshot/components/onboarding-flow';
import { Badge } from '@/components/ui/badge';

const STEPS = [
  {
    icon: Camera,
    title: 'Upload one photo',
    body: 'Any clear selfie works — no professional camera needed.',
  },
  {
    icon: Sparkles,
    title: 'Pick a style, generate',
    body: 'Choose from professional looks. Three headshots ready in under 10 seconds.',
  },
  {
    icon: Download,
    title: 'Preview free — own for $5',
    body: 'Watermarked previews are on us. Pay $5 once to unlock full-resolution downloads.',
  },
];

const STATS = [
  { value: '< 10s', label: 'generation time' },
  { value: '$5', label: 'to unlock full-res' },
  { value: '$200+', label: 'saved vs. photographer' },
  { value: '100%', label: 'money-back guarantee' },
];

const COMPARISON = [
  {
    label: 'Traditional photographer',
    price: '$200 – $500',
    time: 'Days to schedule',
    output: '5–10 edited shots',
    highlight: false,
  },
  {
    label: 'Monthly AI subscriptions',
    price: '$20 – $50 / mo',
    time: 'Subscription lock-in',
    output: 'Generic results',
    highlight: false,
  },
  {
    label: 'Headshot AI',
    price: '$5 one-time',
    time: 'Ready in 10 seconds',
    output: '3 custom headshots',
    highlight: true,
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-6 pt-16 pb-24 sm:pt-24 sm:pb-32 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Copy */}
            <motion.div
              className="space-y-8 max-w-xl"
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7 }}
            >
              <Badge variant="secondary" className="px-3 py-1 text-xs font-semibold">
                <Zap className="mr-1 h-3 w-3" />
                AI-powered · Results in 10 seconds
              </Badge>

              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                Professional headshots
                <span className="block text-primary">in seconds.</span>
              </h1>

              <p className="text-xl leading-relaxed text-muted-foreground">
                Upload one selfie. Get three studio-quality headshots instantly. Preview them free —
                unlock full-res for <strong className="text-foreground">just $5</strong>.
              </p>

              <ul className="space-y-3">
                {[
                  'No photographer or studio needed',
                  'Works from any clear selfie',
                  'Free watermarked preview — pay only if you love them',
                  '100% money-back guarantee',
                ].map((point) => (
                  <li key={point} className="flex items-center gap-3 text-base">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Check className="h-3.5 w-3.5 text-primary" />
                    </span>
                    {point}
                  </li>
                ))}
              </ul>

              <div className="grid grid-cols-2 gap-4 pt-2 sm:grid-cols-4">
                {STATS.map(({ value, label }) => (
                  <div key={label} className="text-center">
                    <div className="text-2xl font-bold">{value}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Onboarding form */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="flex items-center justify-center"
            >
              <Suspense fallback={null}>
                <OnboardingFlow />
              </Suspense>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-muted/30 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <motion.div
            className="mb-16 text-center"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">How it works</h2>
            <p className="mt-4 text-lg text-muted-foreground">Three steps. Under a minute.</p>
          </motion.div>

          <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <motion.div
                key={title}
                className="space-y-4 text-center"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                viewport={{ once: true }}
              >
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border bg-background shadow-sm">
                  <Icon className="h-8 w-8 text-primary" />
                </div>
                <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Step {i + 1}
                </div>
                <h3 className="text-xl font-semibold">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing comparison */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-4xl px-6 lg:px-8">
          <motion.div
            className="mb-16 text-center"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Skip the $300 photographer.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Professional headshots used to mean days of scheduling, hours of shooting, and a
              painful bill. Not anymore.
            </p>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-3">
            {COMPARISON.map(({ label, price, time, output, highlight }, i) => (
              <motion.div
                key={label}
                className={`space-y-3 rounded-2xl border p-6 ${
                  highlight
                    ? 'border-primary bg-primary/5 shadow-lg'
                    : 'border-border bg-background'
                }`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                viewport={{ once: true }}
              >
                {highlight && <Badge className="mb-1">Best value</Badge>}
                <div className="font-semibold">{label}</div>
                <div className="text-2xl font-bold text-primary">{price}</div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div>{time}</div>
                  <div>{output}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust footer */}
      <section className="bg-muted/30 py-16">
        <div className="mx-auto max-w-4xl space-y-4 px-6 text-center">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Shield className="h-4 w-4" />
            Your photo is processed securely and never sold. Explicit biometric consent required.
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 text-amber-400" />
              100% money-back guarantee
            </span>
            <span className="flex items-center gap-1">
              <Shield className="h-3.5 w-3.5" />
              GDPR-compliant
            </span>
            <span className="flex items-center gap-1">
              <Zap className="h-3.5 w-3.5" />
              Results in under 10 seconds
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
