import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Organization, Project } from "@/lib/allium/organization-service";
import type { AssetWithRelations } from "@/lib/allium/asset-manager";
import { ArrowUpRight, Boxes, ImageOff, Upload } from "lucide-react";
import { organization } from "@/lib/allium/organization-service";
import { assetManager } from "@/lib/allium/asset-manager";
import { useAuth } from "../context/AuthContext";
import AssetStatusBadges from "../components/AssetStatusBadges";
import HealthBadge from "../components/HealthBadge";
import UploadDialog from "../components/UploadDialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ProjectsPage() {
  const { profile } = useAuth();

  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);

  const [assets, setAssets] = useState<AssetWithRelations[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  // Load organizations the user belongs to, and default to the first one.
  useEffect(() => {
    organization.organization
      .getByUser()
      .then((list) => {
        setOrgs(list);
        setOrgId((current) => current ?? list[0]?.id ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load organizations."));
  }, []);

  // Load the selected org's projects, and default to the first one.
  useEffect(() => {
    if (!orgId) return;
    setProjects([]);
    setProjectId(null);
    organization.projects
      .getByOrg(orgId)
      .then((res) => {
        setProjects(res.data);
        setProjectId(res.data[0]?.id ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load projects."));
  }, [orgId]);

  const loadAssets = (pid: string) => {
    setLoading(true);
    setError(null);
    assetManager.assets
      .getByProject(pid)
      .then(setAssets)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load assets."))
      .finally(() => setLoading(false));
  };

  // Load assets whenever the selected project changes.
  useEffect(() => {
    if (!projectId) {
      setAssets([]);
      return;
    }
    loadAssets(projectId);
  }, [projectId]);

  const selectedOrg = orgs.find((o) => o.id === orgId) ?? null;
  const selectedProject = projects.find((p) => p.id === projectId) ?? null;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-1">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Upload, build, and manage 3D and Unreal Engine project assets.
          </p>
        </div>
        <HealthBadge />
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Organization</span>
          <Select value={orgId ?? undefined} onValueChange={setOrgId}>
            <SelectTrigger className="w-55">
              <SelectValue placeholder="Select organization" />
            </SelectTrigger>
            <SelectContent>
              {orgs.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Project</span>
          <Select
            value={projectId ?? undefined}
            onValueChange={setProjectId}
            disabled={projects.length === 0}
          >
            <SelectTrigger className="w-55">
              <SelectValue placeholder={projects.length ? "Select project" : "No projects"} />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          type="button"
          onClick={() => setUploadOpen(true)}
          disabled={!orgId || !projectId || !profile}
          className="ml-auto"
        >
          <Upload className="size-4" />
          New upload
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && <p className="text-sm text-muted-foreground">Loading assets...</p>}

      {!loading && !error && assets.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Boxes className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No assets in this project yet. Upload one to get started.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && assets.length > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {assets.map((asset) => (
            <Link key={asset.id} to={`/projects/${asset.id}`} className="group">
              <Card className="h-full overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10">
                <div className="flex aspect-video w-full items-center justify-center bg-muted">
                  {asset.thumb ? (
                    <img src={asset.thumb} alt="" className="size-full object-cover" />
                  ) : (
                    <ImageOff className="size-8 text-muted-foreground" />
                  )}
                </div>
                <CardContent className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-1 text-base font-semibold text-foreground">
                    <span className="truncate">{asset.name}</span>
                    <ArrowUpRight className="size-4 shrink-0 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
                  </div>
                  <Badge variant="secondary" className="self-start">
                    {asset.assetType === "UNREAL_PROJECT" ? "Unreal Project" : "Other 3D"}
                  </Badge>
                  <AssetStatusBadges asset={asset} />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {orgId && projectId && profile && (
        <UploadDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          orgId={orgId}
          projectId={projectId}
          userId={profile.id}
          orgName={selectedOrg?.name}
          projectName={selectedProject?.name}
          onUploaded={() => loadAssets(projectId)}
        />
      )}
    </div>
  );
}
