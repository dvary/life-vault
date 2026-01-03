import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Confetti from 'react-confetti';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);
  const timeoutRef = useRef(null);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  // Cleanup timeout on component unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Frontend validation to match backend
    if (!formData.email || formData.email.trim() === '') {
      alert('Email address is required');
      return;
    }
    if (!formData.password || formData.password.trim() === '') {
      alert('Password is required');
      return;
    }
    
    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      alert('Please enter a valid email address');
      return;
    }
    
    setLoading(true);
    
    const result = await login(formData.email, formData.password);
    
    if (result.success) {
      // Trigger confetti on successful login
      setShowConfetti(true);
      setConfettiKey(prev => prev + 1);
      
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Set new timeout with proper cleanup
      timeoutRef.current = setTimeout(() => {
        setShowConfetti(false);
        // Add a small delay to ensure state is updated
        navigate('/dashboard', { replace: true });
      }, 3000);
    }
    
    setLoading(false);
  };

  return (
    <>
      {showConfetti && (
        <Confetti
          key={confettiKey}
          width={window.innerWidth}
          height={window.innerHeight}
          recycle={false}
          numberOfPieces={300}
          colors={['#10B981', '#34D399', '#6EE7B7', '#A7F3D0', '#D1FAE5', '#059669', '#047857']}
          gravity={0.2}
          wind={0.1}
          tweenDuration={8000}
        />
      )}
      <div className="min-h-screen flex items-center justify-center bg-background-primary py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 animate-fade-in">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-2xl flex items-center justify-center shadow-soft mb-6">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">
            Welcome Back
          </h1>
          <p className="text-neutral-600">
            Sign in to your Life Vault account
          </p>
        </div>
        
        {/* Form */}
        <div className="card responsive-padding">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="form-group">
                <label htmlFor="email" className="form-label">
                  Email address <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="input"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="password" className="form-label">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="input"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="loading-spinner"></div>
                  <span>Signing in...</span>
                </div>
              ) : (
                'Sign in'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-sm text-neutral-600">
            Don't have an account?{' '}
            <Link 
              to="/register" 
              className="font-medium text-primary-600 hover:text-primary-700 transition-colors duration-200"
            >
              Create one here
            </Link>
          </p>
        </div>

        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-primary-100 to-secondary-100 rounded-full opacity-20"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-secondary-100 to-accent-100 rounded-full opacity-20"></div>
        </div>
        </div>
      </div>
    </>
  );
};

export default Login;
