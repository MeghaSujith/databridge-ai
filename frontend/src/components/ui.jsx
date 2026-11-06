import React from 'react';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';

export function Card({ children, className = '', style = {} }) {
  return (
    <div
      className={`rounded-xl ${className}`}
      style={{ background: '#fff', border: '1px solid #e0e0e0', ...style }}
    >
      {children}
    </div>
  );
}

export function Badge({ color = 'blue', children }) {
  const colors = {
    blue: { bg: '#ddeeff', text: '#0353e9' },
    green: { bg: '#defbe6', text: '#198038' },
    red: { bg: '#fff1f1', text: '#da1e28' },
    yellow: { bg: '#fef3cd', text: '#a16207' },
    gray: { bg: '#f4f4f4', text: '#525252' },
    purple: { bg: '#f0e6ff', text: '#7c3aed' },
  };
  const c = colors[color] || colors.gray;
  return (
    <span style={{
      background: c.bg, color: c.text,
      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600
    }}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  const map = {
    completed: 'green', failed: 'red', pending: 'yellow', running: 'blue',
  };
  return <Badge color={map[status] || 'gray'}>{status}</Badge>;
}

export function Spinner({ size = 20 }) {
  return <Loader2 size={size} className="animate-spin" style={{ color: '#0f62fe' }} />;
}

export function Alert({ type = 'info', children }) {
  const cfg = {
    info:    { bg: '#edf5ff', border: '#b0d2ff', icon: null, text: '#0043ce' },
    success: { bg: '#defbe6', border: '#a7f0ba', icon: CheckCircle, text: '#198038' },
    error:   { bg: '#fff1f1', border: '#ffd7d9', icon: AlertCircle, text: '#da1e28' },
    warning: { bg: '#fef3cd', border: '#ffe598', icon: AlertCircle, text: '#a16207' },
  };
  const c = cfg[type] || cfg.info;
  const Icon = c.icon;
  return (
    <div style={{
      background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8,
      padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-start',
      color: c.text, fontSize: 13,
    }}>
      {Icon && <Icon size={16} style={{ flexShrink: 0, marginTop: 1 }} />}
      <div>{children}</div>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#161616', margin: 0 }}>{title}</h1>
        {subtitle && <p style={{ color: '#525252', fontSize: 13.5, margin: '4px 0 0' }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Button({ children, onClick, variant = 'primary', size = 'md', disabled, loading, className = '', style = {} }) {
  const sizes = { sm: '6px 12px', md: '8px 18px', lg: '11px 24px' };
  const variants = {
    primary:   { bg: '#0f62fe', color: '#fff',     border: 'transparent',  hoverBg: '#0353e9' },
    secondary: { bg: '#fff',    color: '#0f62fe',  border: '#0f62fe',     hoverBg: '#edf5ff' },
    danger:    { bg: '#da1e28', color: '#fff',     border: 'transparent',  hoverBg: '#ba1a21' },
    ghost:     { bg: 'transparent', color: '#525252', border: '#e0e0e0', hoverBg: '#f4f4f4' },
    success:   { bg: '#198038', color: '#fff',     border: 'transparent',  hoverBg: '#145229' },
  };
  const v = variants[variant] || variants.primary;
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`flex items-center gap-2 font-medium transition-all ${className}`}
      style={{
        padding: sizes[size],
        background: disabled ? '#c6c6c6' : v.bg,
        color: disabled ? '#8d8d8d' : v.color,
        border: `1px solid ${v.border}`,
        borderRadius: 6,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        fontSize: size === 'sm' ? 12 : size === 'lg' ? 15 : 13.5,
        fontWeight: 500,
        ...style,
      }}
    >
      {loading && <Spinner size={14} />}
      {children}
    </button>
  );
}

export function DataTable({ columns, data, maxHeight = 400 }) {
  if (!data || !data.length) {
    return (
      <div style={{ textAlign: 'center', color: '#8d8d8d', padding: 32, fontSize: 13 }}>
        No data to display
      </div>
    );
  }
  const cols = columns || Object.keys(data[0]);
  return (
    <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight, borderRadius: 6 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
        <thead>
          <tr style={{ background: '#f4f4f4', position: 'sticky', top: 0 }}>
            {cols.map(c => (
              <th key={c} style={{
                padding: '8px 12px', textAlign: 'left', fontWeight: 600,
                color: '#525252', borderBottom: '1px solid #e0e0e0',
                whiteSpace: 'nowrap', fontSize: 11.5,
              }}>
                {typeof c === 'object' ? c.label : c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, ri) => (
            <tr key={ri} style={{ borderBottom: '1px solid #f0f0f0' }}
              onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {cols.map(c => {
                const key = typeof c === 'object' ? c.key : c;
                const render = typeof c === 'object' ? c.render : null;
                const val = row[key];
                return (
                  <td key={key} style={{
                    padding: '8px 12px', color: val == null ? '#c1c1c1' : '#161616',
                    maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {render ? render(val, row) : (val == null ? '—' : String(val))}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Select({ value, onChange, options, label, style = {} }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && <label style={{ fontSize: 12, fontWeight: 500, color: '#525252' }}>{label}</label>}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          padding: '7px 10px', borderRadius: 6, border: '1px solid #e0e0e0',
          fontSize: 13, color: '#161616', background: '#fff', cursor: 'pointer', ...style
        }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

export function Input({ value, onChange, placeholder, label, style = {} }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && <label style={{ fontSize: 12, fontWeight: 500, color: '#525252' }}>{label}</label>}
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          padding: '7px 10px', borderRadius: 6, border: '1px solid #e0e0e0',
          fontSize: 13, color: '#161616', outline: 'none', ...style
        }}
        onFocus={e => e.target.style.borderColor = '#0f62fe'}
        onBlur={e => e.target.style.borderColor = '#e0e0e0'}
      />
    </div>
  );
}

export function ProgressBar({ value, max = 100, color = '#0f62fe', height = 6 }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div style={{ background: '#e0e0e0', borderRadius: height, height, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: height, transition: 'width 0.5s ease' }} />
    </div>
  );
}

export function QualityScore({ score }) {
  const color = score >= 90 ? '#198038' : score >= 75 ? '#0f62fe' : score >= 50 ? '#f1c21b' : '#da1e28';
  const label = score >= 90 ? 'Excellent' : score >= 75 ? 'Good' : score >= 50 ? 'Fair' : 'Poor';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 44, height: 44, borderRadius: '50%', border: `3px solid ${color}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700, color,
      }}>
        {score}
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color }}>{label}</div>
        <div style={{ fontSize: 11, color: '#8d8d8d' }}>Quality Score</div>
      </div>
    </div>
  );
}

