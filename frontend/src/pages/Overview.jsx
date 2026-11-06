import React, { useEffect, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  Database, CheckCircle2, AlertCircle, TrendingUp, Layers, Copy, Plus
} from 'lucide-react';
import { getOverviewStats } from '../api';
import { Card, Badge, Spinner, StatusBadge, Button, QualityScore } from '../components/ui';

function StatCard({ icon: Icon, label, value, color = '#0f62fe', sub }) {
  return (
    <Card style={{ padding: '20px 24px' }}>
      <div className="flex items-start justify-between">
        <div>
          <div style={{ color: '#525252', fontSize: 12, fontWeight: 500, marginBottom: 6 }}>{label}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#161616' }}>{value}</div>
          {sub && <div style={{ fontSize: 11, color: '#8d8d8d', marginTop: 4 }}>{sub}</div>}
        </div>
        <div style={{
          width: 44, height: 44, borderRadius: 10, background: `${color}15`,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Icon size={22} color={color} />
        </div>
      </div>
    </Card>
  );
}

const COLORS = { excellent: '#198038', good: '#0f62fe', fair: '#f1c21b', poor: '#da1e28' };
const PIE_COLORS = ['#198038', '#0f62fe', '#f1c21b', '#da1e28'];

export default function Overview({ onNavigate }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    getOverviewStats()
      .then(setStats)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Spinner size={32} />
    </div>
  );

  if (error) return (
    <div style={{ padding: 32 }}>
      <div style={{ color: '#da1e28', fontSize: 14 }}>Error loading stats: {error}</div>
    </div>
  );

  const activityData = Object.entries(stats.activity_by_day || {}).map(([date, count]) => ({
    date: date.slice(5), count,
  }));

  const qualityPieData = Object.entries(stats.quality_distribution || {})
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: k.charAt(0).toUpperCase() + k.slice(1), value: v }));

  return (
    <div className="animate-fade-in" style={{ padding: 32 }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#161616', margin: 0 }}>
            Platform Overview
          </h1>
          <p style={{ color: '#525252', fontSize: 13.5, marginTop: 4 }}>
            Real-time metrics from your enterprise data integration platform
          </p>
        </div>
        <Button onClick={() => onNavigate('sources')} style={{ gap: 6 }}>
          <Plus size={15} /> New Integration
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4 mb-6" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <StatCard icon={Database} label="Total Datasets" value={stats.total_datasets} color="#0f62fe"
          sub="Uploaded datasets" />
        <StatCard icon={CheckCircle2} label="Successful Integrations" value={stats.successful_integrations} color="#198038"
          sub={`of ${stats.total_integrations} total`} />
        <StatCard icon={TrendingUp} label="Records Processed" value={stats.total_records_processed.toLocaleString()} color="#8a3ffc"
          sub="Across all integrations" />
      </div>
      <div className="grid grid-cols-3 gap-4 mb-6" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <StatCard icon={Copy} label="Duplicates Detected" value={stats.total_duplicates_detected} color="#f1c21b"
          sub="Removed during integration" />
        <StatCard icon={Layers} label="Avg. Quality Score" value={`${stats.average_quality_score}%`} color="#0f62fe"
          sub="Across all integrations" />
        <StatCard icon={AlertCircle} label="Failed Integrations" value={stats.failed_integrations} color="#da1e28"
          sub="Requiring attention" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Activity Chart */}
        <Card style={{ padding: 24 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16, color: '#161616' }}>
            Integration Activity
          </div>
          {activityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="count" stroke="#0f62fe" fill="#ddeeff" strokeWidth={2} name="Integrations" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8d8d8d', fontSize: 13 }}>
              No integration activity yet. <br />
              <span style={{ color: '#0f62fe', cursor: 'pointer', marginLeft: 4 }} onClick={() => onNavigate('sources')}>
                Start your first integration →
              </span>
            </div>
          )}
        </Card>

        {/* Quality Distribution */}
        <Card style={{ padding: 24 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16, color: '#161616' }}>
            Quality Distribution
          </div>
          {qualityPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={qualityPieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                  dataKey="value" nameKey="name" label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}>
                  {qualityPieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8d8d8d', fontSize: 13 }}>
              Run integrations to see quality metrics
            </div>
          )}
        </Card>
      </div>

      {/* Recent Jobs */}
      <Card style={{ padding: 24 }}>
        <div className="flex items-center justify-between mb-4">
          <div style={{ fontWeight: 600, fontSize: 14, color: '#161616' }}>Recent Integration Jobs</div>
          <Button variant="ghost" size="sm" onClick={() => onNavigate('history')}>View All →</Button>
        </div>
        {stats.recent_jobs.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#8d8d8d', padding: '24px 0', fontSize: 13 }}>
            No integrations yet.{' '}
            <span style={{ color: '#0f62fe', cursor: 'pointer' }} onClick={() => onNavigate('sources')}>
              Upload datasets and start integrating →
            </span>
          </div>
        ) : (
          <div>
            {stats.recent_jobs.map(job => (
              <div key={job.id} className="flex items-center justify-between"
                style={{ padding: '10px 0', borderBottom: '1px solid #f4f4f4' }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 13, color: '#161616' }}>{job.name}</div>
                  <div style={{ fontSize: 11.5, color: '#8d8d8d' }}>
                    {new Date(job.created_at).toLocaleString()} · {job.records_output?.toLocaleString()} records
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {job.quality_score != null && <QualityScore score={job.quality_score} />}
                  <StatusBadge status={job.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

