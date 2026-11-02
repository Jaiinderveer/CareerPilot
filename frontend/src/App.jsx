import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Dashboard from './pages/Dashboard'
import Roadmaps from './pages/Roadmaps'
import Recruiters from './pages/Recruiters'
import Internships from './pages/Internships'
import Skills from './pages/Skills'
import Profile from './pages/Profile'
import CompleteProfile from './pages/CompleteProfile'
import AccountSettings from './pages/AccountSettings'
import Login from './pages/Login'
import Signup from './pages/Signup'
import DashboardLayout from './components/layout/DashboardLayout'

function AuthLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#070B16] text-sm text-slate-400">
      Loading session…
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { session, loading, isConfigured, isDemoMode } = useAuth()

  if (loading) return <AuthLoading />
  if (isDemoMode || !isConfigured) return children
  if (!session) return <Navigate to="/login" replace />

  return children
}

function PublicOnlyRoute({ children }) {
  const { session, loading } = useAuth()

  if (loading) return <AuthLoading />
  if (session) return <Navigate to="/dashboard" replace />

  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
          <Route path="/signup" element={<PublicOnlyRoute><Signup /></PublicOnlyRoute>} />
          <Route path="/complete-profile" element={<ProtectedRoute><CompleteProfile /></ProtectedRoute>} />
          <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/roadmaps" element={<Roadmaps />} />
            <Route path="/recruiters" element={<Recruiters />} />
            <Route path="/recruiters/:recruiterId" element={<Recruiters />} />
            <Route path="/internships" element={<Internships />} />
            <Route path="/skills" element={<Skills />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/account-settings" element={<AccountSettings />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}