import React, { useEffect, useState } from 'react';
import { ShieldCheck, RefreshCw, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { getDatasets, getDataQuality } from '../api';
import {
  Card, Spinner, Button, Alert, PageHeader, Select,
  Badge, ProgressBar, QualityScore, DataTable
} from '../components/ui';

function MetricCard({ label, value, total, color }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div style={{ background: '#f4f4f4', borderRadius: 8, padding: '16px 20px' }}>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>{value.toLocaleString()}</div>
      <div style={{ fontSize: 12, color: '#525252', marginTop: 4 }}>{label}</div>
      {total != null && (
        <div style={{ marginTop: 8 }}>
          <ProgressBar value={pct} color={color} />
          <div style={{ fontSize: 10, color: '#8d8d8d', marginTop: 3 }}>{pct}% of total</div>
        </div>
      )}
    </div>
  );
}

export default function DataQuality() {
  const [datasets, setDatasets] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [quality, setQuality] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getDatasets().then(d => {
      setDatasets(d);
      if (d.length > 0) setSelectedId(d[0].id);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedId) loadQuality(selectedId);
  }, [selectedId]);

  const loadQuality = async (id) => {
    setLoading(true);
    setError('');
    try {
      const q = await getDataQuality(id);
      setQuality(q);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const dsOptions = datasets.map(d => ({ value: d.id, label: d.filename }));

  return (
    <div className="animate-fade-in" style={{ padding: 32 }}>
      <PageHeader
        title="Data Quality Engine"
        subtitle="Analyze and score data quality across your datasets"
        action={
          <Button variant="ghost" size="sm" onClick={() => selectedId && loadQuality(selectedId)}>
            <RefreshCw size={14} /> Refresh
          </Button>
        }
      />

      {/* Dataset selector */}
      <Card style={{ padding: 20, marginBottom: 20 }}>
        <div className="flex items-center gap-4">
          <div style={{ flex: 1, maxWidth: 400 }}>
            <Select
              label="Analyze Dataset"
              value={selectedId}
              onChange={setSelectedId}
              options={dsOptions.length ? dsOptions : [{ value: '', label: 'No datasets uploaded' }]}
            />
          </div>
          {quality && <QualityScore score={quality.quality_score} />}
        </div>
      </Card>

      {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spinner size={32} /></div>
      ) : quality ? (
        <>
          {/* Metric grid */}
          <div className="grid grid-cols-4 gap-4 mb-6" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <MetricCard label="Total Records" value={quality.total_records} color="#0f62fe" />
            <MetricCard label="Valid Records" value={quality.valid_records} total={quality.total_records} color="#198038" />
            <MetricCard label="Duplicate Records" value={quality.duplicate_count} total={quality.total_records} color="#f1c21b" />
            <MetricCard label="Missing Values" value={quality.missing_value_count} total={quality.total_records * 10} color="#da1e28" />
          </div>

          {/* Summary scores */}
          <Card style={{ padding: 24, marginBottom: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16, color: '#161616' }}>
              Quality Dimensions
            </div>
            <div className="grid grid-cols-3 gap-6">
              {Object.entries(quality.summary || {}).map(([key, val]) => (
                <div key={key}>
                  <div className="flex justify-between mb-1">
                    <span style={{ fontSize: 13, color: '#525252', textTransform: 'capitalize' }}>{key}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#161616' }}>{val}%</span>
                  </div>
                  <ProgressBar
                    value={val}
                    color={val >= 90 ? '#198038' : val >= 70 ? '#0f62fe' : val >= 50 ? '#f1c21b' : '#da1e28'}
                  />
                </div>
              ))}
            </div>
          </Card>

          {/* Empty columns */}
          {quality.empty_columns?.length > 0 && (
            <div className="mb-4">
              <Alert type="warning">
                <strong>Empty columns detected:</strong>{' '}
                {quality.empty_columns.join(', ')}
              </Alert>
            </div>
          )}

          {/* Per-column quality */}
          <Card style={{ padding: 24 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16, color: '#161616' }}>
              Column-Level Quality Analysis
            </div>
            <DataTable
              maxHeight={500}
              columns={[
                { key: 'column', label: 'Column' },
                { key: 'dtype', label: 'Type', render: v => <Badge color="gray">{v}</Badge> },
                { key: 'completeness', label: 'Completeness', render: (v) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ProgressBar value={v} color={v >= 90 ? '#198038' : v >= 70 ? '#f1c21b' : '#da1e28'} />
                    <span style={{ fontSize: 11, minWidth: 36, fontWeight: 600,
                      color: v >= 90 ? '#198038' : v >= 70 ? '#a16207' : '#da1e28' }}>
                      {v}%
                    </span>
                  </div>
                )},
                { key: 'missing', label: 'Missing', render: v => (
                  <span style={{ color: v > 0 ? '#da1e28' : '#198038', fontWeight: 600 }}>{v}</span>
                )},
                { key: 'unique', label: 'Unique' },
                { key: 'invalid_emails', label: 'Invalid Emails', render: v => v > 0
                  ? <Badge color="red">{v}</Badge> : <Badge color="green">0</Badge>
                },
                { key: 'issues', label: 'Issues', render: (issues) => (
                  issues?.length > 0
                    ? <span style={{ color: '#da1e28', fontSize: 11 }}>{issues.join('; ')}</span>
                    : <span style={{ color: '#198038', fontSize: 11 }}>✓ Clean</span>
                )},
              ]}
              data={quality.column_quality}
            />
          </Card>
        </>
      ) : (
        <Card style={{ padding: 60, textAlign: 'center' }}>
          <ShieldCheck size={40} color="#c1c1c1" style={{ margin: '0 auto 12px' }} />
          <div style={{ color: '#8d8d8d', fontSize: 14 }}>
            {datasets.length === 0
              ? 'Upload a dataset to analyze its quality.'
              : 'Select a dataset to begin analysis.'}
          </div>
        </Card>
      )}
    </div>
  );
}

