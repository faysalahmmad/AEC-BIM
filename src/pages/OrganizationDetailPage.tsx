import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type {
  Organization,
  OrganizationInvite,
  OrganizationRole,
  OrganizationUser,
  Space,
} from "@/lib/allium/organization-service";
import {
  ArrowLeft,
  ArrowUpRight,
  Box,
  Check,
  Copy,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { organization } from "@/lib/allium/organization-service";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function OrganizationDetailPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<Organization | null>(null);
  const [users, setUsers] = useState<OrganizationUser[]>([]);
  const [roles, setRoles] = useState<OrganizationRole[]>([]);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDomain, setEditDomain] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteOrgOpen, setDeleteOrgOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [pendingInvites, setPendingInvites] = useState<OrganizationInvite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [invitesError, setInvitesError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [cancelingInviteId, setCancelingInviteId] = useState<string | null>(null);

  const [spaces, setSpaces] = useState<Space[]>([]);
  const [spacesLoading, setSpacesLoading] = useState(false);
  const [spacesError, setSpacesError] = useState<string | null>(null);
  const [newSpaceOpen, setNewSpaceOpen] = useState(false);
  const [createSpaceName, setCreateSpaceName] = useState("");
  const [creatingSpace, setCreatingSpace] = useState(false);
  const [createSpaceError, setCreateSpaceError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    Promise.all([
      organization.organization.getById(orgId),
      organization.organization.getUsers(orgId),
      organization.organization.getRoles(),
    ])
      .then(([org, orgUsers, orgRoles]) => {
        if (cancelled) return;
        setDetail(org);
        setEditName(org.name);
        setEditDomain(org.domain);
        setUsers(orgUsers);
        setRoles(orgRoles);
        setInviteRoleId((prev) => prev || (orgRoles[0]?.id ?? ""));
      })
      .catch((err) => {
        if (cancelled) return;
        setDetailError(err instanceof Error ? err.message : "Failed to load organization.");
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const loadInvites = (id: string) => {
    setInvitesLoading(true);
    setInvitesError(null);
    return organization.organizationInvites
      .getPendingUsers(id)
      .then(setPendingInvites)
      .catch((err) => setInvitesError(err instanceof Error ? err.message : "Failed to load invites."))
      .finally(() => setInvitesLoading(false));
  };

  useEffect(() => {
    if (!orgId) return;
    loadInvites(orgId);
  }, [orgId]);

  const loadSpaces = (id: string) => {
    setSpacesLoading(true);
    setSpacesError(null);
    return organization.spaces
      .getSpaceAll(id)
      .then(setSpaces)
      .catch((err) => setSpacesError(err instanceof Error ? err.message : "Failed to load spaces."))
      .finally(() => setSpacesLoading(false));
  };

  useEffect(() => {
    if (!orgId) return;
    loadSpaces(orgId);
  }, [orgId]);

  const roleName = (roleId: string) => roles.find((r) => r.id === roleId)?.name ?? roleId;

  const handleCopyId = () => {
    if (!detail) return;
    navigator.clipboard.writeText(detail.id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!orgId) return;
    setSaveError(null);
    setSaving(true);
    try {
      const updated = await organization.organization.update(orgId, {
        name: editName,
        domain: editDomain || null,
      });
      setDetail(updated);
      setEditOpen(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save organization.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!orgId) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      await organization.organization.delete(orgId);
      navigate("/organizations");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete organization.");
    } finally {
      setDeleting(false);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    try {
      await organization.organization.deleteUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Failed to remove user.");
    }
  };

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault();
    if (!orgId || !inviteRoleId) return;
    setInviteError(null);
    setInviting(true);
    try {
      await organization.organizationInvites.create({
        orgId,
        email: inviteEmail,
        roleId: inviteRoleId,
      });
      setInviteEmail("");
      await loadInvites(orgId);
      setInviteOpen(false);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Failed to send invite.");
    } finally {
      setInviting(false);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    if (!orgId) return;
    setCancelingInviteId(inviteId);
    try {
      await organization.organizationInvites.delete(inviteId);
      await loadInvites(orgId);
    } catch (err) {
      setInvitesError(err instanceof Error ? err.message : "Failed to cancel invite.");
    } finally {
      setCancelingInviteId(null);
    }
  };

  const handleCreateSpace = async (e: FormEvent) => {
    e.preventDefault();
    if (!orgId) return;
    setCreateSpaceError(null);
    setCreatingSpace(true);
    try {
      await organization.spaces.create({ id: null, name: createSpaceName, orgId });
      setCreateSpaceName("");
      await loadSpaces(orgId);
      setNewSpaceOpen(false);
    } catch (err) {
      setCreateSpaceError(err instanceof Error ? err.message : "Failed to create space.");
    } finally {
      setCreatingSpace(false);
    }
  };

  return (
    <div className="text-left">
      <Link
        to="/organizations"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Organizations
      </Link>

      {detailLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {detailError && (
        <Alert variant="destructive">
          <AlertDescription>{detailError}</AlertDescription>
        </Alert>
      )}

      {!detailLoading && detail && (
        <>
          <div className="mb-5 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {detail.logoSmallUrl ? (
                <img
                  src={detail.logoSmallUrl}
                  alt=""
                  className="size-14 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-brand-2 text-lg font-semibold text-on-brand">
                  {initials(detail.name)}
                </span>
              )}
              <div>
                <h1 className="mb-0.5">{detail.name}</h1>
                <p className="text-sm text-muted-foreground">
                  {detail.domain || "No domain set"}
                </p>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon-sm">
                  <MoreHorizontal />
                  <span className="sr-only">Organization actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setEditOpen(true);
                  }}
                >
                  <Pencil />
                  Edit organization
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={(e) => {
                    e.preventDefault();
                    setDeleteOrgOpen(true);
                  }}
                >
                  <Trash2 />
                  Delete organization
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="mb-5 grid grid-cols-3 divide-x divide-border overflow-hidden rounded-lg border border-border">
            <div className="px-3 py-2.5">
              <p className="mb-0.5 text-[11px] tracking-wide text-muted-foreground uppercase">ID</p>
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-medium text-foreground">{detail.id}</p>
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  <span className="sr-only">Copy ID</span>
                </button>
              </div>
            </div>
            <div className="px-3 py-2.5" title={new Date(detail.createdAt).toLocaleString()}>
              <p className="mb-0.5 text-[11px] tracking-wide text-muted-foreground uppercase">
                Created
              </p>
              <p className="truncate text-sm font-medium text-foreground">
                {new Date(detail.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="px-3 py-2.5" title={new Date(detail.updatedAt).toLocaleString()}>
              <p className="mb-0.5 text-[11px] tracking-wide text-muted-foreground uppercase">
                Updated
              </p>
              <p className="truncate text-sm font-medium text-foreground">
                {new Date(detail.updatedAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          <Tabs defaultValue="users">
            <TabsList className="w-full">
              <TabsTrigger value="users">Users ({users.length + pendingInvites.length})</TabsTrigger>
              <TabsTrigger value="spaces">Spaces ({spaces.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="users" className="flex flex-col gap-4 pt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Users</p>
                <Button type="button" size="sm" onClick={() => setInviteOpen(true)}>
                  <Plus className="size-3.5" />
                  Invite user
                </Button>
              </div>

              {invitesError && (
                <Alert variant="destructive">
                  <AlertDescription>{invitesError}</AlertDescription>
                </Alert>
              )}
              {!invitesLoading && pendingInvites.length > 0 && (
                <div className="flex flex-col gap-1 rounded-lg border border-dashed border-border p-2">
                  <p className="px-1.5 py-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    Pending
                  </p>
                  <ul className="flex flex-col gap-1">
                    {pendingInvites.map((invite) => (
                      <li
                        key={invite.id}
                        className="flex items-center justify-between gap-4 rounded-lg px-1.5 py-1.5 text-sm"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Mail className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate text-foreground">{invite.email}</span>
                          <Badge variant="secondary" className="shrink-0">
                            {roleName(invite.roleId)}
                          </Badge>
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleCancelInvite(invite.id)}
                          disabled={cancelingInviteId === invite.id}
                        >
                          <X className="size-3.5" />
                          <span className="sr-only">Cancel invite</span>
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!invitesLoading && users.length === 0 && pendingInvites.length === 0 && (
                <p className="text-sm text-muted-foreground">No users found.</p>
              )}
              {users.length > 0 && (
                <ul className="flex flex-col gap-1">
                  {users.map((user) => (
                    <li
                      key={user.id}
                      className="flex items-center justify-between gap-4 rounded-lg px-1.5 py-1.5 text-sm transition-colors hover:bg-muted/50"
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                          {initials(user.name ?? user.email)}
                        </span>
                        <span className="truncate text-foreground">
                          {user.name ?? user.email}
                        </span>
                        <Badge variant="secondary" className="shrink-0">
                          {roleName(user.roleId)}
                        </Badge>
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleRemoveUser(user.id)}
                      >
                        <X className="size-3.5" />
                        <span className="sr-only">Remove user</span>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="spaces" className="flex flex-col gap-4 pt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Spaces</p>
                <Button type="button" size="sm" onClick={() => setNewSpaceOpen(true)}>
                  <Plus className="size-3.5" />
                  New space
                </Button>
              </div>

              {spacesLoading && <p className="text-sm text-muted-foreground">Loading spaces...</p>}
              {spacesError && (
                <Alert variant="destructive">
                  <AlertDescription>{spacesError}</AlertDescription>
                </Alert>
              )}
              {!spacesLoading && !spacesError && spaces.length === 0 && (
                <p className="text-sm text-muted-foreground">No spaces yet.</p>
              )}
              {!spacesLoading && spaces.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {spaces.map((space) => (
                    <Link
                      key={space.id}
                      to={`/organizations/${orgId}/spaces/${space.id}`}
                      className="group"
                    >
                      <Card className="h-full transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/10">
                        <CardContent className="flex items-center gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-primary/15 to-brand-2/15 text-primary">
                            <Box className="size-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">
                              {space.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {space.currentParticipantSum} online · {space.spaceItemSum} items
                            </p>
                          </div>
                          <ArrowUpRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit organization</DialogTitle>
            <DialogDescription>Update this organization's name and domain.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-domain">Domain</Label>
              <Input
                id="edit-domain"
                placeholder="example.com"
                value={editDomain}
                onChange={(e) => setEditDomain(e.target.value)}
              />
            </div>
            {saveError && (
              <Alert variant="destructive">
                <AlertDescription>{saveError}</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite user</DialogTitle>
            <DialogDescription>Send an invitation to join this organization.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInvite} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invite-role">Role</Label>
              <Select value={inviteRoleId} onValueChange={setInviteRoleId}>
                <SelectTrigger id="invite-role" className="w-full">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {inviteError && (
              <Alert variant="destructive">
                <AlertDescription>{inviteError}</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button type="submit" disabled={inviting || !inviteRoleId}>
                {inviting ? "Sending..." : "Send invite"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={newSpaceOpen} onOpenChange={setNewSpaceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New space</DialogTitle>
            <DialogDescription>Create a space within this organization.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSpace} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="create-space-name">Name</Label>
              <Input
                id="create-space-name"
                value={createSpaceName}
                onChange={(e) => setCreateSpaceName(e.target.value)}
                autoFocus
                required
              />
            </div>
            {createSpaceError && (
              <Alert variant="destructive">
                <AlertDescription>{createSpaceError}</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button type="submit" disabled={creatingSpace}>
                {creatingSpace ? "Creating..." : "Create space"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOrgOpen} onOpenChange={setDeleteOrgOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{detail?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the organization and all of its data. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <Alert variant="destructive">
              <AlertDescription>{deleteError}</AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete organization"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
