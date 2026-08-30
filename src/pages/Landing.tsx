import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  FileText,
  Globe,
  Megaphone,
  MessageSquareWarning,
  Radar,
  Search,
  Sparkles,
  SquareCheck,
  Target,
  ThumbsUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FunnelChart } from "@/components/dashboard/FunnelChart";
import { useAuth } from "@/lib/auth";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
};

const FEATURES = [
  {
    icon: Search,
    title: "Competitor discovery",
    description: "Type a niche and industry — Brand Aid finds and lists your top competitors. No manual research.",
  },
  {
    icon: Globe,
    title: "Auto site + review fetch",
    description: "Website content and Google reviews pulled automatically per competitor. Nothing to copy-paste.",
  },
  {
    icon: MessageSquareWarning,
    title: "Review mining",
    description: "Recurring complaint patterns extracted as evidence-backed weaknesses, not guesswork.",
  },
  {
    icon: Target,
    title: "SWOT + outposition plan",
    description: "Evidence-backed SWOT per competitor, plus concrete tips on how to outposition them.",
  },
  {
    icon: Megaphone,
    title: "Ad strategy teardown",
    description: "Paste ad copy from the Meta Ad Library and get the messaging angle in one click.",
  },
  {
    icon: FileText,
    title: "7-day campaign generator",
    description: "AI drafts hooks, captions, and creative concepts into an approval queue — you stay in control.",
  },
];

export default function Landing() {
  const { user } = useAuth();
  const primaryHref = user ? "/dashboard" : "/login";
  const primaryLabel = user ? "Go to dashboard" : "Get started free";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="relative overflow-hidden bg-sidebar text-sidebar-foreground">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/30 blur-3xl"
            animate={{ opacity: [0.4, 0.7, 0.4], scale: [1, 1.15, 1] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute -right-24 top-40 h-80 w-80 rounded-full bg-ring/25 blur-3xl"
            animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.1, 1] }}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          />
        </div>

        <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Radar className="h-4.5 w-4.5" />
            </div>
            <span className="text-sm font-semibold">Brand Aid</span>
          </div>
          <Button asChild variant="secondary" size="sm">
            <Link to={primaryHref}>{user ? "Go to dashboard" : "Sign in"}</Link>
          </Button>
        </nav>

        <div className="relative z-10 mx-auto max-w-4xl px-6 pb-28 pt-16 text-center sm:pt-24">
          <motion.div initial="hidden" animate="show" variants={fadeUp} transition={{ duration: 0.6 }}>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sidebar-border bg-sidebar-accent/60 px-3 py-1 text-xs font-medium text-sidebar-foreground/80">
              <Sparkles className="h-3 w-3" /> AI Competitor &amp; Ad-Strategy Intelligence
            </span>
          </motion.div>

          <motion.h1
            initial="hidden"
            animate="show"
            variants={fadeUp}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mt-6 text-4xl font-semibold leading-tight tracking-tight sm:text-6xl"
          >
            Know your competitors
            <br />
            <span className="bg-gradient-to-r from-primary via-ring to-primary bg-clip-text text-transparent">
              before they know you're watching.
            </span>
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="show"
            variants={fadeUp}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mx-auto mt-6 max-w-2xl text-balance text-base text-sidebar-foreground/70 sm:text-lg"
          >
            Type a niche. Brand Aid finds your top competitors, pulls their site and reviews automatically, and
            turns hours of manual research into an evidence-backed SWOT and a ready-to-approve counter-campaign — in
            minutes.
          </motion.p>

          <motion.div
            initial="hidden"
            animate="show"
            variants={fadeUp}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-9 flex flex-wrap items-center justify-center gap-3"
          >
            <Button asChild size="lg">
              <Link to={primaryHref}>
                {primaryLabel} <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent/60">
              <a href="#how-it-works">See how it works</a>
            </Button>
          </motion.div>

          <motion.p
            initial="hidden"
            animate="show"
            variants={fadeUp}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-5 text-xs text-sidebar-foreground/50"
          >
            No credit card. Runs on a live demo dataset out of the box.
          </motion.p>
        </div>
      </section>

      {/* Funnel / how it works */}
      <section id="how-it-works" className="mx-auto max-w-5xl px-6 py-20">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
          variants={fadeUp}
          transition={{ duration: 0.5 }}
          className="mb-10 text-center"
        >
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">One pipeline, from niche to campaign</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            Every stage is automated except the one Meta's Terms of Service block — pasting ad copy takes ten seconds.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeUp}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card>
            <CardContent className="pt-6">
              <FunnelChart
                stages={[
                  { label: "Competitors found", value: 24, icon: Search },
                  { label: "Selected for analysis", value: 16, icon: SquareCheck },
                  { label: "SWOT completed", value: 16, icon: Sparkles },
                  { label: "Ad angles read", value: 11, icon: Megaphone },
                  { label: "Campaign days drafted", value: 42, icon: FileText },
                  { label: "Days approved", value: 30, icon: ThumbsUp },
                ]}
              />
              <p className="mt-4 text-center text-xs text-muted-foreground">
                Illustrative example volume across a week of use — your dashboard tracks these live.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
          variants={fadeUp}
          transition={{ duration: 0.5 }}
          className="mb-10 text-center"
        >
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Everything the manual grind used to take hours</h2>
        </motion.div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.3 }}
              variants={fadeUp}
              transition={{ duration: 0.4, delay: (i % 3) * 0.08 }}
            >
              <Card className="h-full">
                <CardContent className="pt-6">
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <f.icon className="h-4.5 w-4.5" />
                  </div>
                  <p className="text-sm font-semibold">{f.title}</p>
                  <p className="mt-1.5 text-sm text-muted-foreground">{f.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-border bg-muted/40">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.4 }}
          variants={fadeUp}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-3xl px-6 py-16 text-center"
        >
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Stop guessing what your competitors are doing.
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            Run your first analysis in the next five minutes — no setup required to try it.
          </p>
          <Button asChild size="lg" className="mt-6">
            <Link to={primaryHref}>
              {primaryLabel} <ArrowRight />
            </Link>
          </Button>
        </motion.div>
      </section>

      <footer className="mx-auto max-w-6xl px-6 py-8 text-center text-xs text-muted-foreground">
        Brand Aid — IIT Patna Generative AI Capstone Sprint 2026. Only publicly available data is used; AI-inferred
        estimates are always labeled.
      </footer>
    </div>
  );
}
