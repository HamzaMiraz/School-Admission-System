import { Link, NavLink, Outlet, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { StudentIdBar } from './components/StudentIdBar';
import { AdminOverviewPage } from './pages/AdminOverviewPage';
import { ApplicationPage } from './pages/ApplicationPage';
import { ClassesPage } from './pages/ClassesPage';
import { CreateClassPage } from './pages/CreateClassPage';
import { MyApplicationsPage } from './pages/MyApplicationsPage';

export function App() {
  return (
    <Routes>
      <Route element={<UserLayout />}>
        <Route path="/" element={<ClassesPage />} />
        <Route path="/applications" element={<MyApplicationsPage />} />
        <Route path="/applications/:holdId" element={<ApplicationPage />} />
      </Route>
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminOverviewPage />} />
        <Route path="create" element={<CreateClassPage />} />
        <Route path="*" element={<NotFound home="/admin" />} />
      </Route>
      <Route element={<UserLayout />}>
        <Route path="*" element={<NotFound home="/" />} />
      </Route>
    </Routes>
  );
}

/** Parents' panel: apply, pay and follow applications for one student. */
function UserLayout() {
  return (
    <div className="app">
      <header className="header">
        <div className="container header-inner">
          <Link to="/" className="brand">
            🏫 School Admission
          </Link>
          <nav className="nav">
            <NavLink to="/" end>
              Classes
            </NavLink>
            <NavLink to="/applications">My applications</NavLink>
            <Link to="/admin" className="nav-switch">
              Admin panel →
            </Link>
          </nav>
        </div>
      </header>
      <div className="container">
        <StudentIdBar />
        <main>
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

/** School admin's panel: manage classes and watch seats. No login (the brief asks for none). */
function AdminLayout() {
  return (
    <div className="app">
      <header className="header header-admin">
        <div className="container header-inner">
          <Link to="/admin" className="brand">
            🛠️ Admin Panel
          </Link>
          <nav className="nav">
            <NavLink to="/admin" end>
              Overview
            </NavLink>
            <NavLink to="/admin/create">Create class</NavLink>
            <Link to="/" className="nav-switch">
              ← User panel
            </Link>
          </nav>
        </div>
      </header>
      <div className="container">
        <main>
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

function NotFound({ home }: { home: string }) {
  return (
    <p>
      Page not found. <Link to={home}>Go back</Link>
    </p>
  );
}
