import React from 'react';
import {
  LayoutDashboard, Database, GitMerge, Wand2,
  ShieldCheck, History, Settings, Zap
} from 'lucide-react';

const NAV = [
  { id: 'overview',  label: 'Overview',              icon: LayoutDashboard },
  { id: 'sources',   label: 'Data Sources',           icon: Database },
  { id: 'schema',    label: 'Schema Mapping',         icon: GitMerge },
  { id: 'transform', label: 'Transformation Studio',  icon: Wand2 },
  { id: 'quality',   label: 'Data Quality',           icon: ShieldCheck },
  { id: 'history',   label: 'Integration History',    icon: History },
  { id: 'settings',  label: 'Settings',               icon: Settings },
];

export default function Sidebar({ activePage, onNavigate }) {
  return (
    <aside
      className="sidebar-scroll flex flex-col overflow-y-auto flex-shrink-0"
      style={{
        width: 240,
        background: '#0f1b2d',
        borderRight: '1px solid #1e3048',
        minHeight: '100vh',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5" style={{ borderBottom: '1px solid #1e3048' }}>
        <div className="flex items-center justify-center rounded-lg"
          style={{ width: 36, height: 36, background: '#0f62fe' }}>
          <Zap size={20} color="#fff" />
        </div>
        <div>
          <div style={{ color: '#fff', fontSize: 14, fontWeight: 700, letterSpacing: '-0.3px' }}>
            DataBridge AI
          </div>
          <div style={{ color: '#8da9c4', fontSize: 11 }}>Enterprise Integration</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3">
        <div style={{ color: '#5a7a9a', fontSize: 10, fontWeight: 600, letterSpacing: '1px', padding: '0 8px 8px' }}>
          PLATFORM
        </div>
        {NAV.map(({ id, label, icon: Icon }) => {
          const active = activePage === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className="flex items-center gap-3 w-full text-left mb-1 transition-all"
              style={{
                padding: '9px 12px',
                borderRadius: 6,
                background: active ? '#0f62fe' : 'transparent',
                color: active ? '#fff' : '#8da9c4',
                fontSize: 13.5,
                fontWeight: active ? 600 : 400,
                border: 'none',
                cursor: 'pointer',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#1e3048'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8da9c4'; } }}
            >
              <Icon size={16} />
              {label}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4" style={{ borderTop: '1px solid #1e3048' }}>
        <div style={{ color: '#5a7a9a', fontSize: 11 }}>DataBridge AI v1.0.0</div>
        <div style={{ color: '#3a5a7a', fontSize: 11 }}>Enterprise Edition</div>
      </div>
    </aside>
  );
}

