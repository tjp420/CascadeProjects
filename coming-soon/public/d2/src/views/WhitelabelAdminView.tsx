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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Palette,
  Plus,
  Trash2,
  RefreshCw,
  Building2,
  Globe,
  CheckCircle2,
  XCircle,
  Eye,
  Code,
} from "lucide-react";
import { apiUrl, authHeaders } from "@/config";
import { toast } from "sonner";

type Partner = {
  partnerId: string;
  name: string;
  displayName: string;
  domains: string[];
  orgId: string | null;
  brand: {
    productName: string;
    tagline: string;
    logoUrl: string | null;
    logoDarkUrl: string | null;
    faviconUrl: string | null;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    backgroundColor: string;
    surfaceColor: string;
    textColor: string;
    reportHeader: string;
    reportFooter: string;
    emailFromName: string;
    emailFromAddress: string;
    emailTemplateColor: string;
    customCss: string | null;
    customDomain: string | null;
    customSubdomain: string | null;
    legalName: string;
    privacyPolicyUrl: string | null;
    termsUrl: string | null;
    supportUrl: string | null;
    helpUrl: string | null;
  };
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  subTenants: { orgId: string; name: string; addedAt: string }[];
};

const COLOR_FIELDS = [
  "primaryColor",
  "secondaryColor",
  "accentColor",
  "backgroundColor",
  "surfaceColor",
  "textColor",
  "emailTemplateColor",
];
const TEXT_FIELDS = [
  "productName",
  "tagline",
  "reportHeader",
  "reportFooter",
  "emailFromName",
  "emailFromAddress",
  "legalName",
];
const URL_FIELDS = [
  "logoUrl",
  "logoDarkUrl",
  "faviconUrl",
  "customDomain",
  "customSubdomain",
  "privacyPolicyUrl",
  "termsUrl",
  "supportUrl",
  "helpUrl",
];

export function WhitelabelAdminView() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [previewCss, setPreviewCss] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    name: "",
    displayName: "",
    domains: "",
    productName: "",
    primaryColor: "#4A90D9",
    secondaryColor: "#36A64F",
    accentColor: "#FF6600",
    backgroundColor: "#0F172A",
    surfaceColor: "#1E293B",
    textColor: "#F1F5F9",
    reportHeader: "",
    customDomain: "",
    customSubdomain: "",
  });

  const fetchPartners = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(apiUrl("/whitelabel/partners"), {
        headers: authHeaders(),
      });
      if (resp.ok) {
        const data = await resp.json();
        setPartners(data.partners || []);
      }
    } catch {
      toast.error("Failed to load whitelabel partners");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  const handleCreate = async () => {
    const domains = createForm.domains
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean);
    if (!createForm.name || domains.length === 0) {
      toast.error("Name and at least one domain are required");
      return;
    }

    const body: Record<string, unknown> = {
      name: createForm.name,
      displayName: createForm.displayName || createForm.name,
      domains,
    };
    for (const field of [...COLOR_FIELDS, ...TEXT_FIELDS, ...URL_FIELDS]) {
      if ((createForm as any)[field]) body[field] = (createForm as any)[field];
    }

    try {
      const resp = await fetch(apiUrl("/whitelabel/partners"), {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.message || "Create failed");
      }
      toast.success("Whitelabel partner created");
      setShowCreate(false);
      setCreateForm({
        name: "",
        displayName: "",
        domains: "",
        productName: "",
        primaryColor: "#4A90D9",
        secondaryColor: "#36A64F",
        accentColor: "#FF6600",
        backgroundColor: "#0F172A",
        surfaceColor: "#1E293B",
        textColor: "#F1F5F9",
        reportHeader: "",
        customDomain: "",
        customSubdomain: "",
      });
      fetchPartners();
    } catch (err: any) {
      toast.error(err.message || "Failed to create partner");
    }
  };

  const handleDelete = async (partnerId: string) => {
    try {
      const resp = await fetch(apiUrl(`/whitelabel/partners/${partnerId}`), {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!resp.ok) throw new Error("Delete failed");
      toast.success("Partner deleted");
      fetchPartners();
    } catch {
      toast.error("Failed to delete partner");
    }
  };

  const handleToggle = async (partner: Partner) => {
    try {
      const resp = await fetch(
        apiUrl(`/whitelabel/partners/${partner.partnerId}`),
        {
          method: "PUT",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: !partner.enabled }),
        },
      );
      if (!resp.ok) throw new Error("Toggle failed");
      toast.success(`Partner ${!partner.enabled ? "enabled" : "disabled"}`);
      fetchPartners();
    } catch {
      toast.error("Failed to toggle partner");
    }
  };

  const handlePreviewCss = async (partnerId: string) => {
    try {
      const resp = await fetch(apiUrl(`/whitelabel/${partnerId}/brand.css`), {
        headers: authHeaders(),
      });
      const css = await resp.text();
      setPreviewCss(css);
    } catch {
      toast.error("Failed to load CSS");
    }
  };

  const handleSaveBrand = async (partner: Partner) => {
    try {
      const resp = await fetch(
        apiUrl(`/whitelabel/partners/${partner.partnerId}`),
        {
          method: "PUT",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ brand: partner.brand }),
        },
      );
      if (!resp.ok) throw new Error("Save failed");
      toast.success("Brand settings saved");
      setEditingPartner(null);
      fetchPartners();
    } catch {
      toast.error("Failed to save brand settings");
    }
  };

  const updateBrandField = (field: string, value: string) => {
    if (!editingPartner) return;
    setEditingPartner({
      ...editingPartner,
      brand: { ...editingPartner.brand, [field]: value },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Whitelabel Partner Branding</h3>
          <p className="text-sm text-muted-foreground">
            Customize logos, colors, and report headers for enterprise reseller
            sub-tenants
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchPartners}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />{" "}
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
            <Plus className="h-4 w-4" /> Add Partner
          </Button>
        </div>
      </div>

      {/* Create Form */}
      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New Whitelabel Partner</CardTitle>
            <CardDescription>
              Configure branding for a reseller organization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Partner Name</Label>
                <Input
                  id="name"
                  value={createForm.name}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={createForm.displayName}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      displayName: e.target.value,
                    })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="domains">Domains (comma-separated)</Label>
              <Input
                id="domains"
                placeholder="acme.com, partner.acme.com"
                value={createForm.domains}
                onChange={(e) =>
                  setCreateForm({ ...createForm, domains: e.target.value })
                }
              />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="productName">Product Name</Label>
                <Input
                  id="productName"
                  value={createForm.productName}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      productName: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customSubdomain">Custom Subdomain</Label>
                <Input
                  id="customSubdomain"
                  placeholder="acme"
                  value={createForm.customSubdomain}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      customSubdomain: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customDomain">Custom Domain</Label>
                <Input
                  id="customDomain"
                  placeholder="compliance.acme.com"
                  value={createForm.customDomain}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      customDomain: e.target.value,
                    })
                  }
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              {COLOR_FIELDS.slice(0, 4).map((field) => (
                <div key={field} className="space-y-2">
                  <Label htmlFor={field}>
                    {field
                      .replace(/([A-Z])/g, " $1")
                      .replace(/^./, (s) => s.toUpperCase())}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id={field}
                      type="color"
                      className="w-12 p-1"
                      value={(createForm as any)[field]}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          [field]: e.target.value,
                        })
                      }
                    />
                    <Input
                      className="flex-1"
                      value={(createForm as any)[field]}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          [field]: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
            <Separator />
            <div className="flex gap-2">
              <Button onClick={handleCreate}>Create Partner</Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Brand Editor */}
      {editingPartner && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Edit Brand: {editingPartner.displayName}
            </CardTitle>
            <CardDescription>
              Customize visual identity and report headers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              {COLOR_FIELDS.map((field) => (
                <div key={field} className="space-y-2">
                  <Label>
                    {field
                      .replace(/([A-Z])/g, " $1")
                      .replace(/^./, (s) => s.toUpperCase())}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      className="w-12 p-1"
                      value={(editingPartner.brand as any)[field] || "#000000"}
                      onChange={(e) => updateBrandField(field, e.target.value)}
                    />
                    <Input
                      className="flex-1"
                      value={(editingPartner.brand as any)[field] || ""}
                      onChange={(e) => updateBrandField(field, e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
            <Separator />
            <div className="grid gap-4 md:grid-cols-2">
              {TEXT_FIELDS.map((field) => (
                <div key={field} className="space-y-2">
                  <Label>
                    {field
                      .replace(/([A-Z])/g, " $1")
                      .replace(/^./, (s) => s.toUpperCase())}
                  </Label>
                  <Input
                    value={(editingPartner.brand as any)[field] || ""}
                    onChange={(e) => updateBrandField(field, e.target.value)}
                  />
                </div>
              ))}
            </div>
            <Separator />
            <div className="grid gap-4 md:grid-cols-2">
              {URL_FIELDS.map((field) => (
                <div key={field} className="space-y-2">
                  <Label>
                    {field
                      .replace(/([A-Z])/g, " $1")
                      .replace(/^./, (s) => s.toUpperCase())}
                  </Label>
                  <Input
                    value={(editingPartner.brand as any)[field] || ""}
                    onChange={(e) => updateBrandField(field, e.target.value)}
                  />
                </div>
              ))}
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Custom CSS</Label>
              <textarea
                className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono"
                placeholder="/* Add custom CSS overrides */"
                value={editingPartner.brand.customCss || ""}
                onChange={(e) => updateBrandField("customCss", e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => handleSaveBrand(editingPartner)}>
                Save Brand
              </Button>
              <Button variant="outline" onClick={() => setEditingPartner(null)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* CSS Preview */}
      {previewCss && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">CSS Preview</CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPreviewCss(null)}
              >
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <pre className="text-xs font-mono bg-muted p-4 rounded-md overflow-auto max-h-80">
              {previewCss}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Partner Cards */}
      {partners.length === 0 && !loading ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Palette className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              No whitelabel partners configured
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Click "Add Partner" to get started
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {partners.map((partner) => (
            <Card key={partner.partnerId}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{ backgroundColor: partner.brand.primaryColor }}
                  >
                    <Building2 className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-sm">
                      {partner.displayName}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {partner.name}
                    </CardDescription>
                  </div>
                </div>
                <Badge variant={partner.enabled ? "default" : "secondary"}>
                  {partner.enabled ? "Active" : "Disabled"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1">
                  {partner.domains.map((d) => (
                    <Badge key={d} variant="outline" className="text-xs">
                      <Globe className="h-3 w-3 mr-1" />
                      {d}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    Brand colors:
                  </span>
                  {COLOR_FIELDS.slice(0, 5).map((field) => (
                    <div
                      key={field}
                      className="h-4 w-4 rounded-full border"
                      style={{ backgroundColor: (partner.brand as any)[field] }}
                      title={field}
                    />
                  ))}
                </div>
                {partner.subTenants.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {partner.subTenants.length} sub-tenant(s)
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingPartner(partner)}
                  >
                    <Palette className="h-3 w-3" /> Edit Brand
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePreviewCss(partner.partnerId)}
                  >
                    <Code className="h-3 w-3" /> CSS
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleToggle(partner)}
                  >
                    {partner.enabled ? (
                      <XCircle className="h-3 w-3" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3" />
                    )}
                    {partner.enabled ? "Disable" : "Enable"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(partner.partnerId)}
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
