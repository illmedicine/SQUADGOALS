import { useAuth } from '../lib/AuthContext';

// Shown once to a signed-in account that hasn't chosen a side yet.
export default function RolePickerPage() {
  const { user, setRole, logout } = useAuth();
  return (
    <div className="gate">
      <div className="gate-card wide">
        <h1>Welcome, {user?.displayName?.split(' ')[0]}! How will you use SquadREN?</h1>
        <div className="role-pick">
          <button onClick={() => setRole('shipper')}>
            <span>📦</span><b>I want to ship something</b>
            <small>Find trucks heading your way and book space on them.</small>
          </button>
          <button onClick={() => setRole('driver')}>
            <span>🚛</span><b>I drive an 18-wheeler</b>
            <small>Sell the empty space on your trailer along your route.</small>
          </button>
        </div>
        <p className="muted small">You can switch anytime from the account menu.</p>
        <button className="link-btn" onClick={logout}>Sign out</button>
      </div>
    </div>
  );
}
