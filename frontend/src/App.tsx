import { Link, Navigate, NavLink, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AdminApplicationsPage } from './pages/AdminApplicationsPage';
import { AdminOverviewPage } from './pages/AdminOverviewPage';
import { ApplicationPage } from './pages/ApplicationPage';
import { ClassesPage } from './pages/ClassesPage';
import { CreateClassPage } from './pages/CreateClassPage';
import { LoginPage } from './pages/LoginPage';
import { MyApplicationsPage } from './pages/MyApplicationsPage';
import { useStudent } from './student';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<UserLayout />}>
        <Route path="/" element={<ClassesPage />} />
        <Route path="/applications" element={<MyApplicationsPage />} />
        <Route path="/applications/:holdId" element={<ApplicationPage />} />
        <Route path="*" element={<NotFound home="/" />} />
      </Route>
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminOverviewPage />} />
        <Route path="applications" element={<AdminApplicationsPage />} />
        <Route path="create" element={<CreateClassPage />} />
        <Route path="*" element={<NotFound home="/admin" />} />
      </Route>
    </Routes>
  );
}

/** Parents' panel: only for a signed-in student; otherwise go to the sign-in page. */
function UserLayout() {
  const { studentId, setStudentId } = useStudent();
  const navigate = useNavigate();

  if (!studentId) return <Navigate to="/login" replace />;

  const signOut = () => {
    setStudentId('');
    navigate('/login', { replace: true });
  };

  return (
    <div className="app">
      <header className="header">
        <div className="container header-inner">
          <Link to="/" className="brand">
            <span className="brand-logo">🏫</span>
            <span>School Admission</span>
          </Link>
          <nav className="nav">
            <NavLink to="/" end>
              Classes
            </NavLink>
            <NavLink to="/applications">My applications</NavLink>
          </nav>
          <div className="user-box">
            <span className="user-id" title="Signed in with this birth registration number">
              <span className="avatar" aria-hidden>👤</span>
              <span className="mono">{studentId}</span>
            </span>
            <button type="button" className="btn btn-header" onClick={signOut}>
              Sign out
            </button>
          </div>
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

/** School admin's panel. No login (the brief asks for none). */
function AdminLayout() {
  return (
    <div className="app">
      <header className="header header-admin">
        <div className="container header-inner">
          <Link to="/admin" className="brand">
            <span className="brand-logo">🛠️</span>
            <span>Admin Panel</span>
          </Link>
          <nav className="nav">
            <NavLink to="/admin" end>
              Overview
            </NavLink>
            <NavLink to="/admin/applications">Applications</NavLink>
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
