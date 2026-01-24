import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';


const Layout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="min-h-screen bg-background-primary transition-all duration-300">
      {/* Top Navigation - Glassmorphic */}
      <nav className="fixed top-0 left-0 right-0 z-40 bg-white/70 backdrop-blur-md border-b border-white/40 shadow-sm transition-all duration-300">
        <div className="container-safe">
          <div className="flex justify-between items-center h-16">
            {/* Logo Section */}
            <div className="flex items-center space-x-3">
              <Link
                to="/dashboard"
                className="hover:opacity-80 transition-opacity duration-200 flex items-center space-x-2 group"
                title="Go to Dashboard"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-accent-500 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/20 group-hover:shadow-primary-500/40 transition-shadow">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary-600 to-secondary-500 bg-clip-text text-transparent cursor-pointer tracking-tight">
                  Life Vault
                </h1>
              </Link>
            </div>

            {/* User Menu & Desktop Navigation */}
            <div className="flex items-center space-x-4">
              {/* Desktop User Info */}
              <div className="hidden sm:flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-neutral-900">
                    Welcome Back
                  </p>
                  <p className="text-xs text-neutral-500 font-medium">
                    {user?.firstName && user?.lastName
                      ? `${user.firstName} ${user.lastName}`
                      : user?.email
                    }
                  </p>
                </div>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-100 to-secondary-100 border border-white shadow-sm flex items-center justify-center text-primary-700 font-bold text-xs ring-2 ring-primary-500/10">
                  {user?.firstName ? user.firstName[0].toUpperCase() : 'U'}
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="btn-ghost btn-sm hidden sm:flex items-center space-x-2"
                title="Sign out"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Sign out</span>
              </button>

              {/* Mobile Profile Icon (only if needed, otherwise MobileNav handles profile) */}
              <div className="sm:hidden">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-100 to-secondary-100 border border-white shadow-sm flex items-center justify-center text-primary-700 font-bold text-sm ring-2 ring-primary-500/10">
                  {user?.firstName ? user.firstName[0].toUpperCase() : 'U'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="pt-20 pb-8 container-safe">
        <div className="animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
