import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider, useAuth } from "@/contexts/AuthContext"
import { ThemeProvider } from "@/contexts/ThemeContext"
import Login from "@/pages/Login"
import { MainLayout } from "@/components/layout/MainLayout"
import ClientsPage from "@/pages/admin/ClientsPage"
import ProjectsPage from "@/pages/ProjectsPage"
import ProjectDetailsPage from "@/pages/projects/ProjectDetailsPage"
import EmployeesPage from "@/pages/admin/EmployeesPage"
import TasksPage from "@/pages/TasksPage"
import AbsencePage from "@/pages/hr/AbsencePage"
import TimeLogsPage from "@/pages/TimeLogsPage"
import AgendaPage from "@/pages/AgendaPage"
import ProductiveHoursPage from "@/pages/admin/ProductiveHoursPage"
import RecordsPage from "@/pages/admin/RecordsPage"
import MonthlyReportPage from "@/pages/admin/MonthlyReportPage"

// Placeholder components
import DashboardPage from "@/pages/DashboardPage"
const AdminDashboard = () => <div>Admin Dashboard</div>

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { session, profile, isLoading } = useAuth()

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (adminOnly && profile?.role !== "admin") {
    return <div>Access Denied: Admins only</div>
  }

  return <>{children}</>
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="dspi-ui-theme">
      <Router>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="projects" element={<ProjectsPage />} />
              <Route path="projects/:id" element={<ProjectDetailsPage />} />
              <Route path="tasks" element={<TasksPage />} />
              <Route path="time-logs" element={<TimeLogsPage />} />
              <Route path="hr" element={<AbsencePage />} />
              <Route path="agenda" element={<AgendaPage />} />

              {/* Admin Routes */}
              <Route
                path="clients"
                element={
                  <ProtectedRoute adminOnly>
                    <ClientsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="employees"
                element={
                  <ProtectedRoute adminOnly>
                    <EmployeesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/records"
                element={
                  <ProtectedRoute adminOnly>
                    <RecordsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/productive-hours"
                element={
                  <ProtectedRoute adminOnly>
                    <ProductiveHoursPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/monthly-report"
                element={
                  <ProtectedRoute adminOnly>
                    <MonthlyReportPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin"
                element={
                  <ProtectedRoute adminOnly>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
            </Route>
          </Routes>
        </AuthProvider>
      </Router>
    </ThemeProvider>
  )
}

export default App
