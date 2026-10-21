import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import sso from "../lib/sso";
import EventLog from "./EventLog";
import "./Layout.css";

export default function Layout() {
  const { status, profile } = useAuth();

  const handleLogout = async () => {
    await sso.logout();
  };

  return (
    <div className="layout">
      <header className="layout-header">
        <span className="layout-brand">Avatar SSO demo</span>
        <nav className="layout-nav">
          {status === "authenticated" ? (
            <>
              <NavLink to="/">Dashboard</NavLink>
              <NavLink to="/profile">Profile</NavLink>
              <NavLink to="/assets">Assets</NavLink>
              <span className="layout-user">{profile?.email}</span>
              <button type="button" onClick={handleLogout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login">Login</NavLink>
              <NavLink to="/register">Register</NavLink>
            </>
          )}
        </nav>
      </header>
      <main className="layout-main">
        <Outlet />
      </main>
      <EventLog />
    </div>
  );
}
