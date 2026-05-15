import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/AuthContext';
import LoginPage from './pages/LoginPage';
import MapPage from './pages/MapPage';
import SquadsPage from './pages/SquadsPage';
import AvatarPage from './pages/AvatarPage';
import BadgesPage from './pages/BadgesPage';
import LeaderboardPage from './pages/LeaderboardPage';
import TripsPage from './pages/TripsPage';
import ProfilePage from './pages/ProfilePage';
import PrivacyPage from './pages/PrivacyPage';
import VisitedPlacesPage from './pages/VisitedPlacesPage';
import NavBar from './components/NavBar';

function Protected({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();
  return (
    <div className="app-shell">
      <main className="app-main">
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
          <Route path="/" element={<Protected><MapPage /></Protected>} />
          <Route path="/squads" element={<Protected><SquadsPage /></Protected>} />
          <Route path="/places" element={<Protected><VisitedPlacesPage /></Protected>} />
          <Route path="/avatar" element={<Protected><AvatarPage /></Protected>} />
          <Route path="/badges" element={<Protected><BadgesPage /></Protected>} />
          <Route path="/leaderboard" element={<Protected><LeaderboardPage /></Protected>} />
          <Route path="/trips" element={<Protected><TripsPage /></Protected>} />
          <Route path="/profile" element={<Protected><ProfilePage /></Protected>} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {user && <NavBar />}
    </div>
  );
}
