import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import sso from "../lib/sso";
import "./ProfilePage.css";

export default function ProfilePage() {
  const { profile } = useAuth();
  const [firstName, setFirstName] = useState(profile?.firstName ?? "");
  const [lastName, setLastName] = useState(profile?.lastName ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setFirstName(profile?.firstName ?? "");
    setLastName(profile?.lastName ?? "");
  }, [profile?.firstName, profile?.lastName]);

  if (!profile) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      await sso.profileUpdate({ firstName, lastName });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      await sso.avatarUpdate(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Avatar upload failed.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="profile-page">
      <h1>Profile</h1>

      <div className="profile-avatar">
        {profile.photoURL ? (
          <img src={profile.photoURL} alt="" />
        ) : (
          <div className="profile-avatar-placeholder">
            {profile.firstName?.[0]}
            {profile.lastName?.[0]}
          </div>
        )}
        <label className="profile-avatar-upload">
          {uploading ? "Uploading..." : "Change avatar"}
          <input type="file" accept="image/*" onChange={handleAvatarChange} disabled={uploading} hidden />
        </label>
      </div>

      <dl className="profile-meta">
        <dt>Email</dt>
        <dd>{profile.email}</dd>
        <dt>User ID</dt>
        <dd>{profile.id}</dd>
      </dl>

      <form onSubmit={handleSubmit} className="profile-form">
        <label>
          First name
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
        </label>
        <label>
          Last name
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
        </label>
        {error && <p className="profile-error">{error}</p>}
        {success && <p className="profile-success">Saved.</p>}
        <button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save changes"}
        </button>
      </form>
    </div>
  );
}
