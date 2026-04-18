import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import AppLayout from "./pages/AppLayout";
import TripsPage from "./pages/TripsPage";
import TripDetailPage from "./pages/TripDetailPage";
import AdminPage from "./pages/AdminPage";
import TelegramSettingsPage from "./pages/TelegramSettingsPage";
import PublicTripPage from "./pages/PublicTripPage";
import { ProtectedRoute } from "./components/ProtectedRoute";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/share/trips/:id" element={<PublicTripPage />} />

        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="trips" replace />} />
          <Route path="trips" element={<TripsPage />} />
          <Route path="trips/:id" element={<TripDetailPage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="settings/telegram" element={<TelegramSettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
