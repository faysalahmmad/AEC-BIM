import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function DashboardPage() {
  const { profile } = useAuth();

  return (
    <div>
      <h1>Welcome{profile?.firstName ? `, ${profile.firstName}` : ""}</h1>
      <p>You're signed in with Avatar SSO.</p>
      <ul>
        <li>
          <Link to="/profile">View and edit your profile</Link>
        </li>
        <li>
          <Link to="/assets">Browse avatar assets</Link>
        </li>
      </ul>
    </div>
  );
}
