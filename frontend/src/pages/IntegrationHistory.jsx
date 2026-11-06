import React, { useEffect, useState } from 'react';
import { History, Eye, Download, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { getIntegrations, getIntegration } from '../api';
import {
  Card, Badge, Spinner, Button, Alert, PageHeader,
  StatusBadge, QualityScore, DataTable
} from '../components/ui';

function IntegrationDetail({ id, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getIntegration(id).then(setDetail).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div style={{ textAlign: 'center', padding: 24 }}><Spinner /></div>;
  if (!detail) return <Alert type="error">Failed to load integration details.</Alert>;

  return (
    <div style={{ padding: 20 }}>
      <div className="flex items-center justify-between mb-4">
        <div style={{ fontWeight: 700, fontSize: 15, color: '#161616' }}>{detail.name}</div>
        <Button size="sm" variant="ghost" onClick={onClose}>✕ Close</Button>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Input Records', value: detail.records_input },
          { label: 'Output Records', value: detail.records_output },
          { label: 'Duplicates Removed', value: detail.duplicates_removed },
          { label: 'Processing Time', value: `${detail.processing_time_ms}ms` },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: '#f4f4f4', borderRadius: 6, padding: '10px 14px', textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 18, color: '#161616' }}>{value}</div>
            <div style={{ fontSize: 11, color: '#525252' }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: '#161616' }}>
        Transformation Steps
      </div>
      {(detail.transformation_plan || []).length === 0 ? (
        <div style={{ color: '#8d8d8d', fontSize: 13 }}>No transformation steps recorded.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          {detail.transformation_plan.map((step, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: '#f4f4f4', borderRadius: 6, padding: '8px 12px',
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: 4, background: '#0f62fe',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}>{i + 1}</div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: '#161616' }}>
                  {step.operation?.toUpperCase()}
                </div>
                <div style={{ fontSize: 11, color: '#525252' }}>
                  {step.description || JSON.stringify(step.params || {})}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {detail.output_file_path && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#525252', marginBottom: 6 }}>
            Download Final Integrated Dataset:
          </div>
          <div className="flex gap-2">
            {['csv', 'xlsx', 'json'].map(fmt => (
              <a key={fmt} href={`/api/integrations/${detail.id}/export?fmt=${fmt}`} download>
                <Button size="sm" variant="secondary">.{fmt.toUpperCase()}</Button>
              </a>
            ))}
          </div>
        </div>
      )}

      {detail.output_preview && detail.output_preview.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: '#161616' }}>
            Output Dataset Preview (first 10 rows)
          </div>
          <DataTable data={detail.output_preview} columns={detail.output_columns} maxHeight={240} />
        </div>
      )}
    </div>
  );
}

export default function IntegrationHistory() {
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [error, setError] = useState('');

  const refresh = () => {
    setLoading(true);
    getIntegrations()
      .then(setIntegrations)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, []);

  const toggleExpand = (id) => {
    setExpandedId(curr => curr === id ? null : id);
  };

  return (
    <div className="animate-fade-in" style={{ padding: 32 }}>
      <PageHeader
        title="Integration History"
        subtitle="View and manage all past data integration jobs"
        action={
          <Button variant="ghost" size="sm" onClick={refresh}>
            <RefreshCw size={14} /> Refresh
          </Button>
        }
      />

      {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spinner size={32} /></div>
      ) : integrations.length === 0 ? (
        <Card style={{ padding: 60, textAlign: 'center' }}>
          <History size={40} color="#c1c1c1" style={{ margin: '0 auto 12px' }} />
          <div style={{ color: '#8d8d8d', fontSize: 14 }}>No integrations yet.</div>
          <div style={{ color: '#c1c1c1', fontSize: 12, marginTop: 4 }}>
            Use the Transformation Studio to run your first integration.
          </div>
        </Card>
      ) : (
        <div>
          {/* Summary row */}
          <div className="flex gap-4 mb-4" style={{ fontSize: 12.5, color: '#525252' }}>
            <span><strong style={{ color: '#161616' }}>{integrations.length}</strong> total jobs</span>
            <span><strong style={{ color: '#198038' }}>{integrations.filter(i => i.status === 'completed').length}</strong> successful</span>
            <span><strong style={{ color: '#da1e28' }}>{integrations.filter(i => i.status === 'failed').length}</strong> failed</span>
            <span><strong style={{ color: '#161616' }}>{integrations.reduce((s, i) => s + (i.records_output || 0), 0).toLocaleString()}</strong> total records</span>
          </div>

          {integrations.map(job => (
            <Card key={job.id} style={{ marginBottom: 10, overflow: 'hidden' }}>
              <div
                style={{ padding: '14px 20px', cursor: 'pointer' }}
                onClick={() => toggleExpand(job.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <StatusBadge status={job.status} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13.5, color: '#161616' }}>{job.name}</div>
                      <div style={{ fontSize: 11.5, color: '#8d8d8d', marginTop: 2 }}>
                        {job.source_dataset_names?.join(' + ')} ·{' '}
                        {new Date(job.created_at).toLocaleString()} ·{' '}
                        {job.processing_time_ms}ms
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#161616' }}>
                        {job.records_output?.toLocaleString()} records
                      </div>
                      <div style={{ fontSize: 11, color: '#8d8d8d' }}>
                        {job.duplicates_removed} dupes removed
                      </div>
                    </div>
                    {job.quality_score != null && <QualityScore score={job.quality_score} />}
                    {expandedId === job.id ? <ChevronUp size={16} color="#8d8d8d" /> : <ChevronDown size={16} color="#8d8d8d" />}
                  </div>
                </div>
              </div>

              {expandedId === job.id && (
                <div style={{ borderTop: '1px solid #f0f0f0' }}>
                  <IntegrationDetail id={job.id} onClose={() => setExpandedId(null)} />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

