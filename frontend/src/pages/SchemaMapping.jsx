import React, { useEffect, useState } from 'react';
import { GitMerge, ArrowRight, CheckCircle, XCircle, RefreshCw, Zap, Eye } from 'lucide-react';
import { getDatasets, analyzeSchema, applySchemaMapping } from '../api';
import { Card, Badge, Spinner, Button, Alert, PageHeader, Select, DataTable } from '../components/ui';

function ConfidenceBar({ score }) {
  const color = score >= 0.9 ? '#198038' : score >= 0.7 ? '#0f62fe' : score >= 0.5 ? '#f1c21b' : '#da1e28';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, background: '#e0e0e0', borderRadius: 3, height: 5, overflow: 'hidden' }}>
        <div style={{ width: `${score * 100}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 11, color, fontWeight: 600, minWidth: 32 }}>{Math.round(score * 100)}%</span>
    </div>
  );
}

export default function SchemaMapping() {
  const [datasets, setDatasets] = useState([]);
  const [datasetA, setDatasetA] = useState('');
  const [datasetB, setDatasetB] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [mappings, setMappings] = useState([]);
  const [joinKeyA, setJoinKeyA] = useState('');
  const [joinKeyB, setJoinKeyB] = useState('');
  const [joinType, setJoinType] = useState('inner');
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);

  useEffect(() => {
    getDatasets().then(setDatasets).catch(console.error);
  }, []);

  const dsOptions = datasets.map(d => ({ value: d.id, label: d.filename }));
  const dsOptionsAll = [{ value: '', label: 'Select dataset...' }, ...dsOptions];

  const handleAnalyze = async () => {
    setError('');
    if (!datasetA || !datasetB) return setError('Please select two datasets.');
    if (datasetA === datasetB) return setError('Please select two different datasets.');
    setLoading(true);
    try {
      const result = await analyzeSchema({ dataset_a_id: datasetA, dataset_b_id: datasetB });
      setAnalysis(result);
      setMappings(result.mappings.map(m => ({ ...m, accepted: true })));
      if (result.mappings.length > 0) {
        setJoinKeyA(result.mappings[0].source_column);
        setJoinKeyB(result.mappings[0].target_column);
      }
      setStep(2);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async () => {
    setError('');
    setPreviewLoading(true);
    try {
      const accepted = mappings.filter(m => m.accepted);
      const result = await applySchemaMapping({
        dataset_a_id: datasetA,
        dataset_b_id: datasetB,
        mappings: accepted,
        join_key_a: joinKeyA,
        join_key_b: joinKeyB,
        join_type: joinType,
      });
      setPreviewData(result);
      setStep(3);
    } catch (e) {
      setError(e.message);
    } finally {
      setPreviewLoading(false);
    }
  };

  const toggleMapping = (idx) => {
    setMappings(m => m.map((item, i) => i === idx ? { ...item, accepted: !item.accepted } : item));
  };

  const updateMappingTarget = (idx, field, value) => {
    setMappings(m => m.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const colsA = analysis?.dataset_a?.columns || [];
  const colsB = analysis?.dataset_b?.columns || [];

  return (
    <div className="animate-fade-in" style={{ padding: 32 }}>
      <PageHeader
        title="AI Schema Mapping"
        subtitle="Automatically match columns between datasets using AI-powered semantic analysis"
      />

      {/* Steps indicator */}
      <div className="flex items-center gap-4 mb-6">
        {['Select Datasets', 'Review Mappings', 'Preview Result'].map((label, i) => (
          <React.Fragment key={i}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%', border: '2px solid',
                borderColor: step > i + 1 ? '#198038' : step === i + 1 ? '#0f62fe' : '#d0d0d0',
                background: step > i + 1 ? '#198038' : step === i + 1 ? '#0f62fe' : 'transparent',
                color: step >= i + 1 ? '#fff' : '#8d8d8d',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
              }}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: 13, color: step === i + 1 ? '#161616' : '#8d8d8d', fontWeight: step === i + 1 ? 600 : 400 }}>
                {label}
              </span>
            </div>
            {i < 2 && <div style={{ flex: 1, height: 2, background: step > i + 1 ? '#0f62fe' : '#e0e0e0' }} />}
          </React.Fragment>
        ))}
      </div>

      {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}

      {/* Step 1: Select Datasets */}
      <Card style={{ padding: 24, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16, color: '#161616' }}>
          Step 1: Select Datasets to Map
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <Select
              label="Dataset A (Source)"
              value={datasetA}
              onChange={setDatasetA}
              options={dsOptionsAll}
            />
            {datasetA && (
              <div style={{ marginTop: 8 }}>
                {datasets.find(d => d.id === datasetA)?.column_info?.map(c => (
                  <span key={c.name} style={{
                    display: 'inline-block', background: '#edf5ff', borderRadius: 4,
                    padding: '2px 7px', fontSize: 11, color: '#0043ce', margin: '2px 3px 2px 0'
                  }}>{c.name}</span>
                ))}
              </div>
            )}
          </div>
          <div>
            <Select
              label="Dataset B (Target)"
              value={datasetB}
              onChange={setDatasetB}
              options={dsOptionsAll}
            />
            {datasetB && (
              <div style={{ marginTop: 8 }}>
                {datasets.find(d => d.id === datasetB)?.column_info?.map(c => (
                  <span key={c.name} style={{
                    display: 'inline-block', background: '#defbe6', borderRadius: 4,
                    padding: '2px 7px', fontSize: 11, color: '#198038', margin: '2px 3px 2px 0'
                  }}>{c.name}</span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <Button onClick={handleAnalyze} loading={loading} disabled={!datasetA || !datasetB}>
            <Zap size={15} /> {loading ? 'Analyzing...' : 'Analyze Schema with AI'}
          </Button>
        </div>
      </Card>

      {/* Step 2: Review Mappings */}
      {analysis && (
        <Card style={{ padding: 24, marginBottom: 16 }}>
          <div className="flex items-center justify-between mb-4">
            <div style={{ fontWeight: 600, fontSize: 14, color: '#161616' }}>
              Step 2: Review Suggested Mappings
            </div>
            <div className="flex items-center gap-2">
              {analysis.ai_generated ? (
                <Badge color="blue">🤖 AI-Generated</Badge>
              ) : (
                <Badge color="gray">⚙ Pattern-Based</Badge>
              )}
              <span style={{ fontSize: 11.5, color: '#525252' }}>{mappings.filter(m => m.accepted).length} accepted</span>
            </div>
          </div>

          {analysis.notes && (
            <Alert type="info" style={{ marginBottom: 16 }}>{analysis.notes}</Alert>
          )}

          {/* Mapping table */}
          <div style={{ border: '1px solid #e0e0e0', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f4f4f4' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, fontSize: 11.5, color: '#525252' }}>Dataset A Column</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', width: 40 }}></th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, fontSize: 11.5, color: '#525252' }}>Dataset B Column</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, fontSize: 11.5, color: '#525252' }}>Confidence</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, fontSize: 11.5, color: '#525252' }}>Reason</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', width: 80 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((m, i) => (
                  <tr key={i} style={{
                    borderTop: '1px solid #f0f0f0',
                    background: m.accepted ? '#fafffe' : '#fff8f8',
                    opacity: m.accepted ? 1 : 0.6,
                  }}>
                    <td style={{ padding: '10px 14px' }}>
                      <select
                        value={m.source_column}
                        onChange={e => updateMappingTarget(i, 'source_column', e.target.value)}
                        style={{ border: '1px solid #e0e0e0', borderRadius: 4, padding: '3px 6px', fontSize: 12 }}
                      >
                        {colsA.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td style={{ textAlign: 'center' }}><ArrowRight size={14} color="#8d8d8d" /></td>
                    <td style={{ padding: '10px 14px' }}>
                      <select
                        value={m.target_column}
                        onChange={e => updateMappingTarget(i, 'target_column', e.target.value)}
                        style={{ border: '1px solid #e0e0e0', borderRadius: 4, padding: '3px 6px', fontSize: 12 }}
                      >
                        {colsB.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '10px 14px', minWidth: 100 }}>
                      <ConfidenceBar score={m.confidence} />
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 11.5, color: '#525252', maxWidth: 220 }}>
                      {m.reason}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      <button
                        onClick={() => toggleMapping(i)}
                        style={{
                          border: 'none', background: 'none', cursor: 'pointer',
                          color: m.accepted ? '#198038' : '#da1e28',
                        }}
                      >
                        {m.accepted ? <CheckCircle size={18} /> : <XCircle size={18} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Join Config */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <Select label="Join Type" value={joinType} onChange={setJoinType}
              options={[
                { value: 'inner', label: 'INNER JOIN' },
                { value: 'left', label: 'LEFT JOIN' },
                { value: 'right', label: 'RIGHT JOIN' },
                { value: 'outer', label: 'OUTER JOIN' },
              ]}
            />
            <Select label="Join Key (Dataset A)" value={joinKeyA} onChange={setJoinKeyA}
              options={colsA.map(c => ({ value: c, label: c }))}
            />
            <Select label="Join Key (Dataset B)" value={joinKeyB} onChange={setJoinKeyB}
              options={colsB.map(c => ({ value: c, label: c }))}
            />
          </div>

          <Button onClick={handlePreview} loading={previewLoading}>
            <Eye size={15} /> Preview Merged Dataset
          </Button>
        </Card>
      )}

      {/* Step 3: Preview */}
      {previewData && (
        <Card style={{ padding: 24 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#161616', marginBottom: 4 }}>
            Step 3: Merged Dataset Preview
          </div>
          <div style={{ color: '#525252', fontSize: 12.5, marginBottom: 16 }}>
            {previewData.total_rows} rows · {previewData.columns.length} columns · {joinType.toUpperCase()} JOIN
          </div>
          <DataTable data={previewData.preview} columns={previewData.columns} maxHeight={350} />
          <div style={{ marginTop: 12 }}>
            <Alert type="success">
              Mapping preview complete. Go to Transformation Studio to apply operations and execute the integration.
            </Alert>
          </div>
        </Card>
      )}
    </div>
  );
}

