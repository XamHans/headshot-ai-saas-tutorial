'use client';

import {
  BarChart3,
  Bot,
  Brain,
  CheckCircle,
  Cloud,
  Code2,
  Cpu,
  Database,
  Eye,
  FileCode,
  GitBranch,
  Globe,
  Layout,
  MonitorSpeaker,
  Rocket,
  Server,
  Shield,
  TestTube,
  TypeIcon as Type,
  Upload,
  Users,
  Wrench,
  Zap,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Feature {
  icon: React.ComponentType<any>;
  title: string;
  description: string;
  color: string;
}

const featuresData = {
  'all-features': [
    {
      icon: FileCode,
      title: 'Spec-Driven Architecture',
      description:
        'BDD specifications with Gherkin syntax. Define requirements once, implement perfectly every time with AI assistance.',
      color: 'blue',
    },
    {
      icon: Wrench,
      title: 'Dependency Injection',
      description:
        'Clean, testable, and scalable architecture with automatic dependency management that grows with your business.',
      color: 'green',
    },
    {
      icon: TestTube,
      title: 'Comprehensive Testing',
      description:
        'Vitest unit tests, Cucumber BDD, and Playwright E2E testing for bulletproof code quality.',
      color: 'purple',
    },
    {
      icon: Type,
      title: 'Full TypeScript',
      description:
        'Complete type safety with exceptional developer experience, IntelliSense, and compile-time validation.',
      color: 'orange',
    },
    {
      icon: Bot,
      title: 'Claude Code MCP',
      description:
        'Context-aware AI coding with specialized servers for Neon, Vercel, and Playwright integrations.',
      color: 'indigo',
    },
    {
      icon: Shield,
      title: 'Better-Auth Security',
      description:
        'Production-ready authentication with email/password and OAuth providers, tested with 100+ edge cases.',
      color: 'emerald',
    },
    {
      icon: Database,
      title: 'Neon PostgreSQL',
      description:
        'Serverless Postgres with database branching for safe development workflows and instant scaling.',
      color: 'teal',
    },
    {
      icon: Cloud,
      title: 'Vercel Deployment',
      description:
        'Zero-config deployments with edge functions, global CDN, and automatic HTTPS certificates.',
      color: 'gray',
    },
  ],
  architecture: [
    {
      icon: FileCode,
      title: 'Spec-Driven Development',
      description:
        'BDD workflows with Gherkin syntax ensure AI generates code that perfectly matches your requirements.',
      color: 'blue',
    },
    {
      icon: Wrench,
      title: 'Dependency Injection',
      description:
        'Clean architecture with IoC container for testable, maintainable, and scalable code organization.',
      color: 'green',
    },
    {
      icon: Code2,
      title: 'Modular Design',
      description:
        'Domain-driven architecture with clear separation of concerns and business logic encapsulation.',
      color: 'violet',
    },
    {
      icon: Type,
      title: 'TypeScript First',
      description:
        'End-to-end type safety with strict configuration and comprehensive type definitions.',
      color: 'orange',
    },
  ],
  'ai-development': [
    {
      icon: Bot,
      title: 'Claude Code MCP',
      description:
        'Advanced AI coding assistant with full codebase context and specialized development servers.',
      color: 'indigo',
    },
    {
      icon: Users,
      title: 'Specialized Agents',
      description:
        'Multiple AI agents configured for different workflows: BDD, testing, deployment, and code review.',
      color: 'cyan',
    },
    {
      icon: Brain,
      title: 'AI SDK Integration',
      description:
        'Vercel AI SDK with support for OpenAI, Anthropic, and Google AI models with streaming capabilities.',
      color: 'pink',
    },
    {
      icon: Eye,
      title: 'Langfuse Observability',
      description:
        'Complete AI request tracking, analytics, and performance monitoring for production applications.',
      color: 'amber',
    },
  ],
  infrastructure: [
    {
      icon: Database,
      title: 'Neon PostgreSQL',
      description:
        'Serverless database with instant scaling, connection pooling, and git-like branching workflows.',
      color: 'teal',
    },
    {
      icon: Server,
      title: 'Vercel Platform',
      description:
        'Global edge network with serverless functions, automatic deployments, and built-in monitoring.',
      color: 'gray',
    },
    {
      icon: Upload,
      title: 'File Upload System',
      description:
        'Uppy 5.0 with Cloudflare R2 storage, security validation, and multiple upload methods.',
      color: 'blue',
    },
    {
      icon: Zap,
      title: 'Performance Optimized',
      description:
        'Built-in caching, image optimization, and minimal bundle size for lightning-fast user experiences.',
      color: 'yellow',
    },
  ],
  testing: [
    {
      icon: TestTube,
      title: 'Vitest Framework',
      description:
        'Lightning-fast unit and integration testing with excellent TypeScript support and hot reload.',
      color: 'purple',
    },
    {
      icon: CheckCircle,
      title: 'BDD Testing',
      description:
        'Cucumber.js for behavior-driven development with plain-language feature specifications.',
      color: 'green',
    },
    {
      icon: Layout,
      title: 'Playwright E2E',
      description:
        'End-to-end browser automation testing across Chrome, Firefox, and Safari with visual comparisons.',
      color: 'violet',
    },
    {
      icon: BarChart3,
      title: 'Test Coverage',
      description:
        'Comprehensive coverage reporting with service-layer, API, and integration test strategies.',
      color: 'blue',
    },
  ],
  performance: [
    {
      icon: Zap,
      title: 'Framer Motion',
      description:
        'Smooth animations and micro-interactions that enhance user experience without performance impact.',
      color: 'yellow',
    },
    {
      icon: Cpu,
      title: 'Optimized Rendering',
      description:
        'React Server Components and streaming for instant page loads and minimal JavaScript bundles.',
      color: 'red',
    },
    {
      icon: Globe,
      title: 'Edge Computing',
      description:
        'Global edge functions and CDN distribution for sub-100ms response times worldwide.',
      color: 'blue',
    },
    {
      icon: MonitorSpeaker,
      title: 'Observability',
      description:
        'Pino structured logging with OpenTelemetry for comprehensive production monitoring.',
      color: 'rose',
    },
  ],
};

const colorClasses = {
  blue: 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
  green: 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400',
  purple: 'bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
  orange: 'bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
  indigo: 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400',
  emerald: 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
  teal: 'bg-teal-100 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400',
  gray: 'bg-gray-100 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400',
  cyan: 'bg-cyan-100 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400',
  violet: 'bg-violet-100 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400',
  pink: 'bg-pink-100 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400',
  amber: 'bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
  yellow: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400',
  red: 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400',
  rose: 'bg-rose-100 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400',
};

function FeatureCard({ feature, index }: { feature: Feature; index: number }) {
  const IconComponent = feature.icon;
  const colorClass = colorClasses[feature.color as keyof typeof colorClasses];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      viewport={{ once: true }}
      whileHover={{ y: -4 }}
      className="group"
    >
      <Card className="p-6 h-full border border-border/50 hover:border-border transition-all duration-200 hover:shadow-lg">
        <CardContent className="p-0">
          <div className="flex flex-col items-start space-y-4">
            <div className={`p-3 rounded-lg ${colorClass}`}>
              <IconComponent className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold text-base mb-2 group-hover:text-primary transition-colors">
                {feature.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function PowerfulFeaturesSection() {
  const [activeTab, setActiveTab] = useState('all-features');

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      viewport={{ once: true }}
      className="px-8 mt-16"
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-6 mb-12 h-auto p-1">
          <TabsTrigger
            value="all-features"
            className="text-xs md:text-sm py-2 px-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            All Features
          </TabsTrigger>
          <TabsTrigger
            value="architecture"
            className="text-xs md:text-sm py-2 px-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Architecture
          </TabsTrigger>
          <TabsTrigger
            value="ai-development"
            className="text-xs md:text-sm py-2 px-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            AI & Development
          </TabsTrigger>
          <TabsTrigger
            value="infrastructure"
            className="text-xs md:text-sm py-2 px-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Infrastructure
          </TabsTrigger>
          <TabsTrigger
            value="testing"
            className="text-xs md:text-sm py-2 px-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Testing
          </TabsTrigger>
          <TabsTrigger
            value="performance"
            className="text-xs md:text-sm py-2 px-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Performance
          </TabsTrigger>
        </TabsList>

        {Object.entries(featuresData).map(([key, features]) => (
          <TabsContent key={key} value={key} className="mt-0">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
            >
              {features.map((feature, index) => (
                <FeatureCard key={`${key}-${index}`} feature={feature} index={index} />
              ))}
            </motion.div>
          </TabsContent>
        ))}
      </Tabs>
    </motion.div>
  );
}
