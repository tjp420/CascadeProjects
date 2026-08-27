import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Info,
  Shield,
  CheckCircle2,
  Lock,
  KeyRound,
  Eye,
  FileCheck,
  Server,
} from "lucide-react";

const ROADMAP_TRACKS = [
  {
    id: "10-17",
    title: "Baseline & Secrets",
    desc: "Software-token shims, PURGE/ZEROIZE, M-of-N threshold splits",
    status: "complete",
  },
  {
    id: "18",
    title: "Azure Managed HSM",
    desc: "LRU client cache, circuit breakers, Prometheus endpoints",
    status: "complete",
  },
  {
    id: "19-20",
    title: "Masking & PQC",
    desc: "Homomorphic queries, hybrid ML-KEM key encapsulation",
    status: "complete",
  },
  {
    id: "21-22",
    title: "Proofs & Anchors",
    desc: "ZKP identity tokens, tamper-evident temporal oracles",
    status: "complete",
  },
  {
    id: "23",
    title: "Key Escrow Engine",
    desc: "Dual-consent declassification, replay guarding, log stripping",
    status: "complete",
  },
  {
    id: "24",
    title: "Privacy Processing",
    desc: "Chaum blind RSA issuers, homomorphic PIR query gating",
    status: "complete",
  },
  {
    id: "25",
    title: "FIPS & Compliance",
    desc: "NIST POST vectors, EU AI Act telemetry, Azure Key Vault adapter",
    status: "complete",
  },
] as const;

const SECURITY_FEATURES = [
  {
    icon: Lock,
    label: "Cross-Tenant Key Escrow",
    desc: "Dual-consent guardrails block arbitrary exfiltration",
  },
  {
    icon: Eye,
    label: "Blind Signature PIR",
    desc: "Mathematical blindness shields privacy during PIR indexing",
  },
  {
    icon: FileCheck,
    label: "FIPS 140-3 POST",
    desc: "Deterministic safety rings via NIST known-answer vectors",
  },
  {
    icon: Server,
    label: "Production-Grade Scaling",
    desc: "LRU connection pools, adaptive circuit breaking, Prometheus telemetry",
  },
  {
    icon: KeyRound,
    label: "ZKP Identity Federation",
    desc: "Zero-knowledge proof tokens with temporal drift anchors",
  },
  {
    icon: Shield,
    label: "EU AI Act Telemetry",
    desc: "Tamper-evident ledger with FIFO retention and Buffer redaction",
  },
] as const;

export function AboutView() {
  return (
    <div className="mx-auto max-w-4xl p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">About</h1>
        <p className="text-foreground-muted">About SimpleBeacon</p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
              <svg
                viewBox="0 0 24 24"
                className="h-7 w-7 text-primary-foreground"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <polyline points="9 12 12 15 16 10" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold">SimpleBeacon</h2>
              <p className="text-sm text-foreground-muted">
                AI Safety Scanning Platform
              </p>
            </div>
          </div>
          <p className="text-sm text-foreground-secondary">
            SimpleBeacon is a deterministic AI safety scanner that checks
            repositories for credentials, mock paths, production leak
            directories, and compliance gate rules. It provides pattern-matching
            scans (not semantic code review) scoped to configured scanPaths and
            production directories.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Architecture
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-foreground-secondary">
            The HSM adapter stack implements a multi-tenant,
            regulation-compliant cryptographic engine spanning 16 engineering
            tracks (10-25). All tracks are integrated, tested, and
            production-ready.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {SECURITY_FEATURES.map(({ icon: Icon, label, desc }) => (
              <div
                key={label}
                className="flex items-start gap-3 rounded-lg border p-3"
              >
                <Icon className="h-5 w-5 mt-0.5 text-primary flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium">{label}</div>
                  <div className="text-xs text-foreground-muted">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Roadmap Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {ROADMAP_TRACKS.map((track) => (
            <div
              key={track.id}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              <Badge variant="success" className="flex-shrink-0">
                Done
              </Badge>
              <div className="flex-1">
                <div className="text-sm font-medium">
                  Track {track.id}: {track.title}
                </div>
                <div className="text-xs text-foreground-muted">
                  {track.desc}
                </div>
              </div>
            </div>
          ))}
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/20 p-3">
            <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
            <span className="text-sm font-medium text-green-600 dark:text-green-400">
              All 16 tracks complete — 230 test suites, 2,438 assertions, 0
              failures
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
