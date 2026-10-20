import { Suspense, lazy } from 'react';
import { Center, Spinner } from '@chakra-ui/react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { STANDALONE } from './lib/standalone';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const NewGamePage = lazy(() => import('./pages/NewGamePage'));
const GamePage = lazy(() => import('./pages/GamePage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense
          fallback={
            <Center minH="100vh">
              <Spinner size="xl" color="purple.500" />
            </Center>
          }
        >
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          {STANDALONE ? (
            // No accounts on the device: send any account URL straight to the game.
            ['/login', '/register', '/profile'].map((path) => (
              <Route key={path} path={path} element={<Navigate to="/dashboard" replace />} />
            ))
          ) : (
            <>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            </>
          )}
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/games" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
          <Route path="/games/new" element={<ProtectedRoute><NewGamePage /></ProtectedRoute>} />
          <Route path="/games/:id" element={<ProtectedRoute><GamePage /></ProtectedRoute>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
