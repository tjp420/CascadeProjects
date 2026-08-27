import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  RefreshCw,
  Shield,
  Zap,
  DollarSign,
  TrendingUp,
  Bug,
  Activity,
} from "lucide-react";
import { apiUrl, authHeaders } from "@/config";
import { toast } from "sonner";

type DeflectionMetrics = {
  totalScansProcessed: number;
  totalHallucinationsSquashed: number;
  deflectedByCategory: Record<string, number>;
  estimatedDollarsSaved: number;
  weeklySquashed: number;
  timeline: Array<{
    timestamp: string;
    squashed: number;
    [key: string]: string | number;
  }>;
  startedAt: string;
  lastUpdated: string;
};

const CATEGORY_COLORS: Record<string, string> = {
  ai_slop: "#8b5cf6",
  credential_leaks: "#ef4444",
  compliance_violations: "#f59e0b",
  production_leaks: "#ec4899",
  dead_code: "#6b7280",
  weak_crypto: "#f97316",
  hardcoded_urls: "#06b6d4",
  redos: "#84cc16",
  pii_logging: "#e11d48",
  sync_io: "#0ea5e9",
  env_in_git: "#f43f5e",
  hallucinated_imports: "#a855f7",
  custom_ai: "#3b82f6",
  other: "#9ca3af",
};

const CATEGORY_LABELS: Record<string, string> = {
  ai_slop: "AI Slop",
  credential_leaks: "Credential Leaks",
  compliance_violations: "Compliance",
  production_leaks: "Prod Leaks",
  dead_code: "Dead Code",
  weak_crypto: "Weak Crypto",
  hardcoded_urls: "Hardcoded URLs",
  redos: "ReDoS",
  pii_logging: "PII Logging",
  sync_io: "Sync I/O",
  env_in_git: "Env in Git",
  hallucinated_imports: "Fake Imports",
  custom_ai: "Custom AI",
  other: "Other",
};

export function AgentTelemetryCard() {
  const [metrics, setMetrics] = useState<DeflectionMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/audit/agent-deflections"), {
        headers: { ...authHeaders() },
      });
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      } else {
        // Fallback to empty state
        setMetrics(null);
      }
    } catch {
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const pieData = metrics
    ? Object.entries(metrics.deflectedByCategory)
        .filter(([, v]) => v > 0)
        .map(([key, value]) => ({
          name: CATEGORY_LABELS[key] || key,
          value,
          color: CATEGORY_COLORS[key] || "#9ca3af",
        }))
        .sort((a, b) => b.value - a.value)
    : [];

  const timelineData = metrics
    ? metrics.timeline.map((entry) => ({
        time: new Date(entry.timestamp).toLocaleDateString(),
        squashed: entry.squashed,
      }))
    : [];

  return (
    <div className="space-y-4">
      {/* Top stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hallucinations Squashed</CardTitle>
            <Bug className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.totalHallucinationsSquashed.toLocaleString() || "0"}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics?.weeklySquashed.toLocaleString() || 0} this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Token Capital Saved</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${metrics?.estimatedDollarsSaved.toFixed(2) || "0.00"}
            </div>
            <p className="text-xs text-muted-foreground">
              Est. savings from squashed loops
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scans Processed</CardTitle>
            <Activity className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.totalScansProcessed.toLocaleString() || "0"}
            </div>
            <p className="text-xs text-muted-foreground">
              Since {metrics ? new Date(metrics.startedAt).toLocaleDateString() : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pie chart — deflection breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Deflection Breakdown
            </CardTitle>
            <CardDescription>
              Findings intercepted by category
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={(entry) => `${entry.name}: ${entry.value}`}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={`cell-${i}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                {loading ? "Loading..." : "No deflection data yet"}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bar chart — timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Deflection Timeline
            </CardTitle>
            <CardDescription>
              Findings squashed per scan over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            {timelineData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="squashed" fill="#8b5cf6" name="Squashed" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                {loading ? "Loading..." : "No timeline data yet"}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Category badges */}
      {metrics && pieData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Active Protection Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {pieData.map((cat) => (
                <Badge
                  key={cat.name}
                  variant="secondary"
                  className="flex items-center gap-1.5"
                  style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  {cat.name}: {cat.value.toLocaleString()}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Refresh button */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={fetchMetrics} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>
    </div>
  );
}
