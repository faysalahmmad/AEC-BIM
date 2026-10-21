import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { Organization } from "@alliumcloud/organization-service";
import { ArrowUpRight, Building2, Plus } from "lucide-react";
import organization from "../lib/organization";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [newOrgOpen, setNewOrgOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDomain, setCreateDomain] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadOrganizations = () => {
    setLoading(true);
    setListError(null);
    return organization.organization
      .getByUser()
      .then(setOrganizations)
      .catch((err) => setListError(err instanceof Error ? err.message : "Failed to load organizations."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadOrganizations();
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      await organization.organization.create({
        name: createName,
        domain: createDomain || null,
      });
      setCreateName("");
      setCreateDomain("");
      await loadOrganizations();
      setNewOrgOpen(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create organization.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="text-left">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="mb-1">Organizations</h1>
          <p className="text-sm text-muted-foreground">
            Pick an organization to manage its users, invitations, and spaces.
          </p>
        </div>
        {!loading && organizations.length > 0 && (
          <Button type="button" onClick={() => setNewOrgOpen(true)}>
            <Plus className="size-4" />
            New organization
          </Button>
        )}
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading organizations...</p>}
      {listError && (
        <Alert variant="destructive">
          <AlertDescription>{listError}</AlertDescription>
        </Alert>
      )}
      {!loading && !listError && organizations.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-4 py-12 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Building2 className="size-5" />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">No organizations yet</p>
            <p className="text-sm text-muted-foreground">
              Create one to start managing members and spaces.
            </p>
          </div>
          <Button type="button" size="sm" onClick={() => setNewOrgOpen(true)}>
            <Plus className="size-3.5" />
            New organization
          </Button>
        </div>
      )}

      {!loading && organizations.length > 0 && (
        <div className="grid grid-cols-2 gap-5">
          {organizations.map((org) => (
            <Link key={org.id} to={`/organizations/${org.id}`} className="group">
              <Card className="h-full transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10">
                <CardContent className="flex h-full flex-col justify-between gap-6">
                  <div className="flex items-start justify-between gap-3">
                    {org.logoSmallUrl ? (
                      <img
                        src={org.logoSmallUrl}
                        alt=""
                        className="size-14 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-brand-2 text-lg font-semibold text-white">
                        {initials(org.name)}
                      </span>
                    )}
                    <ArrowUpRight className="size-5 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
                  </div>
                  <div>
                    <p className="mb-0.5 text-lg font-semibold text-foreground">{org.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {org.domain || "No domain set"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={newOrgOpen} onOpenChange={setNewOrgOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New organization</DialogTitle>
            <DialogDescription>
              Organizations group members, spaces, and settings together.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="create-name">Name</Label>
              <Input
                id="create-name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="create-domain">Domain</Label>
              <Input
                id="create-domain"
                placeholder="example.com"
                value={createDomain}
                onChange={(e) => setCreateDomain(e.target.value)}
              />
            </div>
            {createError && (
              <Alert variant="destructive">
                <AlertDescription>{createError}</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button type="submit" disabled={creating}>
                {creating ? "Creating..." : "Create organization"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
