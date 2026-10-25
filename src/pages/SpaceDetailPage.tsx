import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { Space, SpaceInvite, SpaceRole, SpaceUser } from "@/lib/allium/organization-service";
import {
  ArrowLeft,
  Box,
  Layers,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Users,
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

function emailInitials(email: string): string {
  return email.slice(0, 2).toUpperCase();
}

export default function SpaceDetailPage() {
  const { orgId, spaceId } = useParams<{ orgId: string; spaceId: string }>();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<Space | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [users, setUsers] = useState<SpaceUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);

  const [roles, setRoles] = useState<SpaceRole[]>([]);

  const [pendingInvites, setPendingInvites] = useState<SpaceInvite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [invitesError, setInvitesError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [cancelingInviteId, setCancelingInviteId] = useState<string | null>(null);

  useEffect(() => {
    if (!spaceId) return;
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    Promise.all([organization.spaces.getById(spaceId), organization.spaces.getRoles()])
      .then(([space, spaceRoles]) => {
        if (cancelled) return;
        if (!space) {
          setDetailError("Space not found.");
          return;
        }
        setDetail(space);
        setEditName(space.name);
        setEditDescription(space.description ?? "");
        setRoles(spaceRoles);
        setInviteRoleId((prev) => prev || (spaceRoles[0]?.id ?? ""));
      })
      .catch((err) => {
        if (cancelled) return;
        setDetailError(err instanceof Error ? err.message : "Failed to load space.");
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [spaceId]);

  const loadUsers = (id: string) => {
    setUsersLoading(true);
    setUsersError(null);
    return organization.spaces
      .getUsers(id)
      .then(setUsers)
      .catch((err) => setUsersError(err instanceof Error ? err.message : "Failed to load users."))
      .finally(() => setUsersLoading(false));
  };

  useEffect(() => {
    if (!spaceId) return;
    loadUsers(spaceId);
  }, [spaceId]);

  const loadInvites = (id: string) => {
    setInvitesLoading(true);
    setInvitesError(null);
    return organization.spaceInvites
      .getPendingUsers(id)
      .then(setPendingInvites)
      .catch((err) => setInvitesError(err instanceof Error ? err.message : "Failed to load invites."))
      .finally(() => setInvitesLoading(false));
  };

  useEffect(() => {
    if (!spaceId) return;
    loadInvites(spaceId);
  }, [spaceId]);

  const roleName = (roleId: string) => roles.find((r) => r.id === roleId)?.name ?? roleId;

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!spaceId) return;
    setSaveError(null);
    setSaving(true);
    try {
      const updated = await organization.spaces.update(spaceId, {
        name: editName,
        description: editDescription || null,
      });
      setDetail(updated);
      setEditOpen(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save space.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!spaceId) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      await organization.spaces.delete(spaceId);
      navigate(`/organizations/${orgId}`);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete space.");
    } finally {
      setDeleting(false);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    try {
      await organization.spaces.deleteUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : "Failed to remove user.");
    }
  };

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault();
    if (!spaceId || !inviteRoleId) return;
    setInviteError(null);
    setInviting(true);
    try {
      await organization.spaceInvites.create({
        inviteLinkId: null,
        spaceId,
        email: inviteEmail,
        roleId: inviteRoleId,
      });
      setInviteEmail("");
      await loadInvites(spaceId);
      setInviteOpen(false);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Failed to send invite.");
    } finally {
      setInviting(false);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    if (!spaceId) return;
    setCancelingInviteId(inviteId);
    try {
      await organization.spaceInvites.delete(inviteId);
      await loadInvites(spaceId);
    } catch (err) {
      setInvitesError(err instanceof Error ? err.message : "Failed to cancel invite.");
    } finally {
      setCancelingInviteId(null);
    }
  };

  return (
    <div className="text-left">
      <Link
        to={`/organizations/${orgId}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to organization
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
              {detail.thumb ? (
                <img
                  src={detail.thumb}
                  alt=""
                  className="size-14 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-brand-2/15 text-primary">
                  <Box className="size-6" />
                </span>
              )}
              <div>
                <h1 className="mb-0.5">{detail.name}</h1>
                <p className="text-sm text-muted-foreground">
                  {detail.description || "No description set"}
                </p>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon-sm">
                  <MoreHorizontal />
                  <span className="sr-only">Space actions</span>
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
                  Edit space
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={(e) => {
                    e.preventDefault();
                    setDeleteOpen(true);
                  }}
                >
                  <Trash2 />
                  Delete space
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="mb-6 flex gap-3">
            <div className="flex flex-1 items-center gap-3 rounded-lg border border-border px-3 py-2.5">
              <span className="flex size-8 items-center justify-center rounded-md bg-gradient-to-br from-primary/15 to-brand-2/15 text-primary">
                <Users className="size-4" />
              </span>
              <div>
                <p className="text-sm leading-none font-semibold text-foreground">
                  {detail.currentParticipantSum}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">Online now</p>
              </div>
            </div>
            <div className="flex flex-1 items-center gap-3 rounded-lg border border-border px-3 py-2.5">
              <span className="flex size-8 items-center justify-center rounded-md bg-gradient-to-br from-primary/15 to-brand-2/15 text-primary">
                <Layers className="size-4" />
              </span>
              <div>
                <p className="text-sm leading-none font-semibold text-foreground">
                  {detail.spaceItemSum}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">Items</p>
              </div>
            </div>
          </div>

          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Users &amp; invitations</p>
            <Button type="button" size="sm" onClick={() => setInviteOpen(true)}>
              <Plus className="size-3.5" />
              Invite user
            </Button>
          </div>

          {invitesError && (
            <Alert variant="destructive" className="mb-3">
              <AlertDescription>{invitesError}</AlertDescription>
            </Alert>
          )}
          {!invitesLoading && pendingInvites.length > 0 && (
            <div className="mb-3 flex flex-col gap-1 rounded-lg border border-dashed border-border p-2">
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

          {usersError && (
            <Alert variant="destructive" className="mb-3">
              <AlertDescription>{usersError}</AlertDescription>
            </Alert>
          )}
          {!usersLoading && users.length === 0 && (
            <p className="text-sm text-muted-foreground">No users in this space yet.</p>
          )}
          {!usersLoading && users.length > 0 && (
            <ul className="flex flex-col gap-1">
              {users.map((user) => (
                <li
                  key={user.id}
                  className="flex items-center justify-between gap-4 rounded-lg px-1.5 py-1.5 text-sm transition-colors hover:bg-muted/50"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                      {emailInitials(user.email)}
                    </span>
                    <span className="truncate text-foreground">{user.email}</span>
                    <Badge variant="secondary" className="shrink-0">
                      {roleName(user.roleId)}
                    </Badge>
                    {user.isPending && (
                      <Badge variant="outline" className="shrink-0">
                        Pending
                      </Badge>
                    )}
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
        </>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit space</DialogTitle>
            <DialogDescription>Update this space's name and description.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-space-name">Name</Label>
              <Input
                id="edit-space-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-space-description">Description</Label>
              <Input
                id="edit-space-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
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
            <DialogDescription>Send an invitation to join this space.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInvite} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invite-space-email">Email</Label>
              <Input
                id="invite-space-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invite-space-role">Role</Label>
              <Select value={inviteRoleId} onValueChange={setInviteRoleId}>
                <SelectTrigger id="invite-space-role" className="w-full">
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

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{detail?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the space. This action cannot be undone.
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
              {deleting ? "Deleting..." : "Delete space"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
