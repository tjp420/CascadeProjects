import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  HelpCircle,
  BookOpen,
  Rocket,
  Keyboard,
  Shield,
  FileCode,
  ExternalLink,
  Zap,
} from "lucide-react";
import { navigate } from "@/router/HashRouter";

export function HelpView() {
  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Help</h1>
        <p className="text-foreground-muted">
          Documentation, guides, and support
        </p>
      </div>

      {/* Getting Started */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5" /> Getting Started
          </CardTitle>
          <CardDescription>Run your first scan in three steps</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center">
              1
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Sign in</p>
              <p className="text-sm text-foreground-muted">
                Navigate to the Sign In page and authenticate with your
                SimpleBeacon credentials.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center">
              2
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Enter a project path</p>
              <p className="text-sm text-foreground-muted">
                On the Analyze page, enter the path to your codebase (e.g.{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                  C:\Users\you\my-project
                </code>{" "}
                or{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                  /opt/render/project/src
                </code>
                ).
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center">
              3
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Run the scan</p>
              <p className="text-sm text-foreground-muted">
                Click "Start Scan" and wait for the results. View findings on
                the Results page and quality metrics on the Quality page.
              </p>
            </div>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            onClick={() => navigate("analyze")}
          >
            <Zap className="h-4 w-4" /> Go to Analyze
          </button>
        </CardContent>
      </Card>

      {/* Scan Profiles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCode className="h-5 w-5" /> Scan Profiles
          </CardTitle>
          <CardDescription>
            Choose the right profile for your project
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <Badge variant="outline" className="mt-0.5">
              universal
            </Badge>
            <div>
              <p className="text-sm font-medium">Universal (default)</p>
              <p className="text-sm text-foreground-muted">
                Scans all source files — JavaScript, TypeScript, Python, C/C++,
                and more. Best for general code quality assessment.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Badge variant="outline" className="mt-0.5">
              dashboard
            </Badge>
            <div>
              <p className="text-sm font-medium">Dashboard</p>
              <p className="text-sm text-foreground-muted">
                Focused on web dashboard and frontend code. Scans JS/TS/HTML/CSS
                files with frontend-specific rules.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Keyboard Shortcuts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" /> Keyboard Shortcuts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            {
              keys: "Ctrl + Shift + R",
              desc: "Hard refresh to clear cached dashboard bundle",
            },
            {
              keys: "Ctrl + K",
              desc: "Focus the search/filter input on Results page",
            },
          ].map((item) => (
            <div key={item.keys} className="flex items-center justify-between">
              <span className="text-sm text-foreground-muted">{item.desc}</span>
              <kbd className="text-xs bg-muted px-2 py-1 rounded font-mono">
                {item.keys}
              </kbd>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Severity Levels */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" /> Severity Levels
          </CardTitle>
          <CardDescription>How findings are classified</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            {
              label: "Critical",
              color: "text-red-500",
              desc: "Security vulnerabilities, credential leaks — must fix immediately",
            },
            {
              label: "High",
              color: "text-orange-500",
              desc: "Serious code quality issues — SQL injection, prototype pollution, broken files",
            },
            {
              label: "Medium",
              color: "text-yellow-500",
              desc: "Moderate issues — insecure random, token bleed, missing rate limits",
            },
            {
              label: "Low",
              color: "text-blue-500",
              desc: "Minor issues — var declarations, equality comparisons, generic naming",
            },
            {
              label: "Info",
              color: "text-gray-500",
              desc: "Informational — governance markers, complexity, documentation gaps",
            },
          ].map((item) => (
            <div key={item.label} className="flex items-start gap-3">
              <span className={`text-sm font-semibold w-20 ${item.color}`}>
                {item.label}
              </span>
              <span className="text-sm text-foreground-muted">{item.desc}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Suppressing False Positives */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" /> Suppressing False Positives
          </CardTitle>
          <CardDescription>
            How to ignore findings in specific files
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm font-medium">File-level ignore</p>
            <p className="text-sm text-foreground-muted mt-1">
              Add this comment in the first 500 characters of a file to suppress
              all findings:
            </p>
            <pre className="text-xs bg-muted p-3 rounded mt-2 overflow-x-auto">
              <code>
                {"// simplebeacon-ignore: reason for ignoring this file"}
              </code>
            </pre>
          </div>
          <div>
            <p className="text-sm font-medium">Line-level ignore</p>
            <p className="text-sm text-foreground-muted mt-1">
              Add this comment on the line before a finding to suppress that
              specific check:
            </p>
            <pre className="text-xs bg-muted p-3 rounded mt-2 overflow-x-auto">
              <code>{"// simplebeacon-ignore: check-id — reason"}</code>
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* FAQ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" /> FAQ
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium">
              Why does the scan show "0 files analyzed"?
            </p>
            <p className="text-sm text-foreground-muted mt-1">
              This happens when the server can't access the project path. Ensure
              the path exists on the server filesystem, or use a local scan via
              Privacy Mode.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium">
              Why am I getting "Local Network Access" prompts?
            </p>
            <p className="text-sm text-foreground-muted mt-1">
              The dashboard probes for a local API server on common dev ports.
              On hosted deployments, this is disabled. If you see this,
              hard-refresh to load the latest bundle.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium">
              Why is my 401 error happening?
            </p>
            <p className="text-sm text-foreground-muted mt-1">
              Your JWT token has expired. Sign in again to get a fresh token.
              The dashboard will automatically redirect you when this happens.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium">What is the gate check?</p>
            <p className="text-sm text-foreground-muted mt-1">
              The gate is a pass/fail threshold based on blocking issues
              (critical + high severity). A PASS means no blocking issues were
              found.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Links */}
      <Card>
        <CardHeader>
          <CardTitle>Resources</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <a
            href="https://github.com/tjp420/CascadeProjects"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm hover:underline"
          >
            <ExternalLink className="h-4 w-4" /> GitHub Repository
          </a>
          <a
            href="https://simplebeacon.pages.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm hover:underline"
          >
            <ExternalLink className="h-4 w-4" /> SimpleBeacon Homepage
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
