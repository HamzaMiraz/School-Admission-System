import { Link, NavLink, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { StudentIdBar } from './components/StudentIdBar';
import { AdminPage } from './pages/AdminPage';
import { ApplicationPage } from './pages/ApplicationPage';
import { ClassesPage } from './pages/ClassesPage';
import { MyApplicationsPage } from './pages/MyApplicationsPage';

export function App() {
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
            <NavLink to="/admin">Create class</NavLink>
          </nav>
        </div>
      </header>
      <div className="container">
        <StudentIdBar />
        <main>
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<ClassesPage />} />
              <Route path="/applications" element={<MyApplicationsPage />} />
              <Route path="/applications/:holdId" element={<ApplicationPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route
                path="*"
                element={
                  <p>
                    Page not found. <Link to="/">Go to classes</Link>
                  </p>
                }
              />
            </Routes>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
