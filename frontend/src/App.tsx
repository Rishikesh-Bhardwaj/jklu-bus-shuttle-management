import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CampusSlideshow } from './components/CampusSlideshow';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { HomeView } from './views/HomeView';
import { LoginView } from './views/LoginView';
import { RegisterView } from './views/RegisterView';
import { DashboardView } from './views/DashboardView';
import { TripsView } from './views/TripsView';
import { ExtraTripsView } from './views/ExtraTripsView';
import { MyBookingsView } from './views/MyBookingsView';
import { FeedbackView } from './views/FeedbackView';
import { ManagerPortalView } from './views/ManagerPortalView';

function AppContent() {
  const { user } = useAuth();
  const [currentView, setCurrentView] = useState<string>('home');
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return (
      localStorage.getItem('theme') === 'dark' ||
      (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
    );
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // View router rendering
  const renderView = () => {
    switch (currentView) {
      case 'home':
        return <HomeView setCurrentView={setCurrentView} />;
      case 'trips':
        return <TripsView setCurrentView={setCurrentView} />;
      case 'extra-trips':
        return <ExtraTripsView setCurrentView={setCurrentView} />;
      case 'my-bookings':
        return user ? (
          <MyBookingsView setCurrentView={setCurrentView} />
        ) : (
          <LoginView setCurrentView={setCurrentView} />
        );
      case 'feedback':
        return <FeedbackView />;
      case 'login':
        return <LoginView setCurrentView={setCurrentView} />;
      case 'register':
        return <RegisterView setCurrentView={setCurrentView} />;
      case 'dashboard':
        return user ? (
          <DashboardView setCurrentView={setCurrentView} />
        ) : (
          <LoginView setCurrentView={setCurrentView} />
        );
      case 'manager-portal':
        return user?.role === 'MANAGER' ? (
          <ManagerPortalView />
        ) : (
          <div className="p-12 text-center text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900">
            Access Restricted: Manager credentials required.
          </div>
        );
      default:
        return <HomeView setCurrentView={setCurrentView} />;
    }
  };

  return (
    <div className="relative min-h-screen text-neutral-900 dark:text-neutral-100 flex flex-col font-sans transition-colors">
      <CampusSlideshow />

      <Navbar
        currentView={currentView}
        setCurrentView={setCurrentView}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderView()}
      </main>

      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
