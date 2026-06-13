import React from 'react';
import { Link } from 'react-router-dom';

const HomeIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const VitalsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
  </svg>
);

const ReportsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const DocumentsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
  </svg>
);

const tabs = [
  { id: 'home', label: 'Home', type: 'link', to: '/dashboard', Icon: HomeIcon },
  { id: 'vitals', label: 'Vitals', type: 'tab', Icon: VitalsIcon },
  { id: 'reports', label: 'Reports', type: 'tab', Icon: ReportsIcon },
  { id: 'documents', label: 'Documents', type: 'tab', Icon: DocumentsIcon },
];

const TabItem = ({ tab, isActive, onTabChange }) => {
  const { label, Icon } = tab;
  const className = `liquid-glass-tab-item${isActive ? ' active' : ''}`;

  if (tab.type === 'link') {
    return (
      <Link to={tab.to} className={className} aria-label={label}>
        <Icon />
        <span className="text-[10px] font-semibold tracking-wide">{label}</span>
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onTabChange(tab.id)}
      className={className}
      aria-label={label}
      aria-current={isActive ? 'page' : undefined}
    >
      <Icon />
      <span className="text-[10px] font-semibold tracking-wide">{label}</span>
    </button>
  );
};

const MemberTabBar = ({ activeTab, onTabChange }) => (
  <div className="liquid-glass-tab-bar-wrapper">
    <nav className="liquid-glass-tab-bar" aria-label="Member navigation">
      {tabs.map((tab) => (
        <TabItem
          key={tab.id}
          tab={tab}
          isActive={tab.type === 'tab' && activeTab === tab.id}
          onTabChange={onTabChange}
        />
      ))}
    </nav>
  </div>
);

export default MemberTabBar;
