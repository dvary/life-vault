import React from 'react';
import { useAuth } from '../../contexts/AuthContext';

const Profile = () => {
    const { user, logout } = useAuth();

    return (
        <div className="p-4 space-y-6 animate-fade-in">
            <div className="glass-panel p-6">
                <div className="flex items-center space-x-4 mb-6">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                        {user?.firstName ? user.firstName[0].toUpperCase() : 'U'}
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">
                            {user?.firstName} {user?.lastName}
                        </h2>
                        <p className="text-gray-500">{user?.email}</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <h3 className="font-semibold text-gray-900 mb-2">Account Details</h3>
                        <div className="grid grid-cols-1 gap-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Member Since</span>
                                <span className="font-medium text-gray-900">{new Date().getFullYear()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Account Type</span>
                                <span className="font-medium text-primary-600">Premium Vault</span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={logout}
                        className="w-full btn-secondary flex items-center justify-center space-x-2 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span>Sign Out</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Profile;
