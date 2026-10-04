import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/AuthContext';
import { LocationProvider } from './lib/LocationContext';
import LandingPage from './pages/LandingPage';
import PrivacyPage from './pages/PrivacyPage';
import RolePickerPage from './pages/RolePickerPage';
import FindTruckPage from './pages/FindTruckPage';
import ShipmentsPage from './pages/ShipmentsPage';
import DriverDashboardPage from './pages/DriverDashboardPage';
import DriverSetupPage from './pages/DriverSetupPage';
import NetworkPage from './pages/NetworkPage';
import { AppHeader, LocationGate, MobileTabs } from './components/freight/ui';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <div className="center fill">Loading…</div>;

  if (!user) {
    return (
      <Routes>
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="*" element={<LandingPage />} />
      </Routes>
    );
  }

  if (!user.role) {
    return (
      <Routes>
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="*" element={<RolePickerPage />} />
      </Routes>
    );
  }

  const isDriver = user.role === 'driver';
  return (
    <LocationProvider active>
      <Routes>
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="*" element={
          <LocationGate>
            <div className="app-shell">
              <AppHeader />
              <main className="app-main">
                <Routes>
                  {isDriver ? (
                    <>
                      <Route path="/" element={<DriverDashboardPage />} />
                      <Route path="/driver/setup" element={<DriverSetupPage />} />
                      <Route path="/network" element={<NetworkPage />} />
                    </>
                  ) : (
                    <>
                      <Route path="/" element={<FindTruckPage />} />
                      <Route path="/shipments" element={<ShipmentsPage />} />
                    </>
                  )}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
              <MobileTabs />
            </div>
          </LocationGate>
        } />
      </Routes>
    </LocationProvider>
  );
}
