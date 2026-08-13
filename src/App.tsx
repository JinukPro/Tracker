import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'
import { IssuesProvider } from './context/IssuesContext'
import { PeopleProvider } from './context/PeopleContext'
import { ProjectsProvider } from './context/ProjectsContext'
import { BoardPage } from './pages/BoardPage'
import { CalendarPage } from './pages/CalendarPage'
import { DashboardPage } from './pages/DashboardPage'
import { DeliverablesPage } from './pages/DeliverablesPage'
import { GanttPage } from './pages/GanttPage'
import { ListPage } from './pages/ListPage'
import { LoginPage } from './pages/LoginPage'
import { SettingsPage } from './pages/SettingsPage'
import { TimelinePage } from './pages/TimelinePage'

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined

export default function App() {
  return (
    <AuthProvider>
      <ProjectsProvider>
        <PeopleProvider>
          <IssuesProvider>
            <BrowserRouter basename={basename}>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route element={<ProtectedRoute />}>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/board" element={<BoardPage />} />
                  <Route path="/list" element={<ListPage />} />
                  <Route path="/timeline" element={<TimelinePage />} />
                  <Route path="/gantt" element={<GanttPage />} />
                  <Route path="/calendar" element={<CalendarPage />} />
                  <Route path="/deliverables" element={<DeliverablesPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </IssuesProvider>
        </PeopleProvider>
      </ProjectsProvider>
    </AuthProvider>
  )
}
