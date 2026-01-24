import React from 'react';

const Health = () => {
    return (
        <div className="p-4 space-y-6 animate-fade-in">
            <div className="glass-panel p-6 text-center">
                <div className="w-16 h-16 mx-auto bg-teal-100 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Health Overview</h2>
                <p className="text-gray-600">
                    Global health statistics and consolidated vitals for all family members will appear here.
                </p>
            </div>
        </div>
    );
};

export default Health;
