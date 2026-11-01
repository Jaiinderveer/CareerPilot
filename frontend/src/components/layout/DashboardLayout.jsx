import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

const titles = {
  '/dashboard': { title: 'Overview', breadcrumb: 'CareerPilot / Dashboard' },
  '/roadmaps': { title: 'My Roadmaps', breadcrumb: 'CareerPilot / Roadmaps' },
  '/recruiters': { title: 'Recruiters', breadcrumb: 'CareerPilot / Recruiters' },
  '/internships': { title: 'Internships', breadcrumb: 'CareerPilot / Internships' },
  '/skills': { title: 'My Skills', breadcrumb: 'CareerPilot / Skills' },
  '/profile': { title: 'My Profile', breadcrumb: 'CareerPilot / Profile' },
}

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const meta = titles[location.pathname] || { title: 'CareerPilot', breadcrumb: 'CareerPilot' }

  return (
    <div className="flex min-h-screen">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          title={meta.title}
          breadcrumb={meta.breadcrumb}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="flex-1 px-4 py-6 md:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
