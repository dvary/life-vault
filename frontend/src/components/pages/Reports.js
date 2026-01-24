import React from 'react';

const Reports = () => {
    return (
        <div className="p-4 space-y-6 animate-fade-in">
            <div className="glass-panel p-6 text-center">
                <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Medical Reports</h2>
                <p className="text-gray-600">
                    A centralized archive of all medical reports and documents across your family vault.
                </p>
            </div>
        </div>
    );
};

export default Reports;
