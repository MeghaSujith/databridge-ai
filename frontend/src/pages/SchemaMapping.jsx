import React, { useEffect, useState } from 'react';
import {
  GitMerge, ArrowRight, CheckCircle, XCircle, RefreshCw,
  Zap, Eye, Plus, X, Database, Check, Layers, AlertCircle
} from 'lucide-react';
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

export default function SchemaMapping({ onNavigate, navigationParams }) {
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

  // Load datasets and handle preselection
  useEffect(() => {
    getDatasets()
      .then(data => {
        setDatasets(data);
        const targetId = navigationParams?.datasetId || sessionStorage.getItem('databridge_selected_dataset_id');
        if (targetId && data.some(d => d.id === targetId)) {
          setDatasetA(targetId);
          sessionStorage.setItem('databridge_selected_dataset_id', targetId);
        }
      })
      .catch(console.error);
  }, [navigationParams?.datasetId]);

  const dsA = datasets.find(d => d.id === datasetA);
  const dsB = datasets.find(d => d.id === datasetB);

  const getFormatStyle = (filename) => {
    const ext = filename?.split('.').pop()?.toUpperCase() || 'CSV';
    if (ext === 'XLSX') return { ext, bg: '#edf5ff', text: '#0043ce' };
    if (ext === 'JSON') return { ext, bg: '#fef3cd', text: '#a16207' };
    return { ext, bg: '#defbe6', text: '#198038' };
  };

  // Dataset 1 can be any dataset except datasetB
  const availableForA = datasets.filter(d => !datasetB || d.id !== datasetB);
  // Dataset 2 can be any dataset except datasetA
  const availableForB = datasets.filter(d => !datasetA || d.id !== datasetA);

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

      {/* ===================================================================== */}
      {/* STEP 1: DATASET SELECTION GRID */}
      {/* ===================================================================== */}
      <Card style={{ padding: 24, marginBottom: 20 }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#161616' }}>
              Step 1: Select Enterprise Datasets to Map
            </div>
            <div style={{ fontSize: 12, color: '#6f6f6f', marginTop: 2 }}>
              Choose a primary source dataset and add a target dataset to compare schemas and map semantic fields
            </div>
          </div>
          {datasetA && datasetB && (
            <Badge color="green">2 Datasets Ready</Badge>
          )}
        </div>

        {datasets.length === 0 ? (
          <div style={{
            background: '#fafafa', border: '1.5px dashed #d0d0d0', borderRadius: 8,
            padding: '36px 20px', textAlign: 'center'
          }}>
            <Database size={32} color="#8d8d8d" style={{ margin: '0 auto 8px' }} />
            <div style={{ fontWeight: 600, fontSize: 14, color: '#161616' }}>No Active Datasets in Workspace</div>
            <div style={{ color: '#6f6f6f', fontSize: 12, marginTop: 4, marginBottom: 14 }}>
              Load sample datasets or upload enterprise files from Data Sources to start schema mapping.
            </div>
            <Button variant="primary" size="sm" onClick={() => onNavigate && onNavigate('sources')}>
              Go to Data Sources <ArrowRight size={12} />
            </Button>
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch relative">
              {/* Dataset 1 (Primary) */}
              {dsA ? (
                <div style={{
                  background: '#fff', border: '1.5px solid #0f62fe', borderRadius: 8,
                  padding: '16px 18px', display: 'flex', flexDirection: 'column',
                  justifyContent: 'space-between', boxShadow: '0 2px 6px rgba(15,98,254,0.08)'
                }}>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span style={{
                          background: '#edf5ff', color: '#0043ce', border: '1px solid #b0d2ff',
                          fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, letterSpacing: '0.4px'
                        }}>
                          DATASET 1 • PRIMARY
                        </span>
                        <span style={{
                          background: getFormatStyle(dsA.filename).bg,
                          color: getFormatStyle(dsA.filename).text,
                          fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4
                        }}>
                          {getFormatStyle(dsA.filename).ext}
                        </span>
                      </div>
                      <select
                        value={datasetA}
                        onChange={(e) => {
                          const newA = e.target.value;
                          setDatasetA(newA);
                          sessionStorage.setItem('databridge_selected_dataset_id', newA);
                          setAnalysis(null);
                          setPreviewData(null);
                        }}
                        style={{
                          fontSize: 11.5, color: '#525252', background: '#f4f4f4',
                          border: '1px solid #d0d0d0', borderRadius: 4, padding: '2px 6px', cursor: 'pointer'
                        }}
                        title="Change Dataset 1"
                      >
                        <option value={dsA.id}>Change: {dsA.filename}</option>
                        {availableForA.filter(d => d.id !== dsA.id).map(d => (
                          <option key={d.id} value={d.id}>{d.filename}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ fontWeight: 700, fontSize: 15, color: '#161616', marginBottom: 2 }}>
                      {dsA.filename}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#6f6f6f', marginBottom: 12 }}>
                      {dsA.rows.toLocaleString()} rows · {dsA.columns} columns · {dsA.file_size_kb?.toFixed(1)} KB
                    </div>

                    <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
                      <div style={{ fontSize: 10.5, fontWeight: 600, color: '#525252', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        Columns ({dsA.column_info?.length || 0})
                      </div>
                      <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto">
                        {dsA.column_info?.map(c => (
                          <span key={c.name} style={{
                            background: '#edf5ff', color: '#0043ce', border: '1px solid #d0e2ff',
                            padding: '2px 6px', borderRadius: 4, fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4
                          }}>
                            <strong>{c.name}</strong>
                            <span style={{ color: '#6f6f6f', fontSize: 10 }}>{c.dtype}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{
                  background: '#fafafa', border: '1.5px dashed #b0d2ff', borderRadius: 8,
                  padding: '24px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', minHeight: 220
                }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#161616', marginBottom: 4 }}>
                    Select Dataset 1 (Primary)
                  </div>
                  <div style={{ color: '#6f6f6f', fontSize: 12, marginBottom: 14 }}>
                    Choose the primary source dataset to map
                  </div>
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        setDatasetA(e.target.value);
                        sessionStorage.setItem('databridge_selected_dataset_id', e.target.value);
                        setAnalysis(null);
                        setPreviewData(null);
                      }
                    }}
                    style={{
                      width: '100%', maxWidth: 300, padding: '7px 10px', borderRadius: 6,
                      border: '1.5px solid #0f62fe', background: '#fff', fontSize: 12.5,
                      fontWeight: 600, color: '#0f62fe', cursor: 'pointer', outline: 'none'
                    }}
                  >
                    <option value="">Select Primary Dataset...</option>
                    {availableForA.map(d => (
                      <option key={d.id} value={d.id} style={{ color: '#161616', fontWeight: 400 }}>
                        {d.filename} ({d.rows} rows, {d.columns} cols)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Dataset 2 (Target) */}
              {dsB ? (
                <div style={{
                  background: '#fff', border: '1.5px solid #198038', borderRadius: 8,
                  padding: '16px 18px', display: 'flex', flexDirection: 'column',
                  justifyContent: 'space-between', boxShadow: '0 2px 6px rgba(25,128,56,0.08)'
                }}>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span style={{
                          background: '#defbe6', color: '#198038', border: '1px solid #a7f3d0',
                          fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, letterSpacing: '0.4px'
                        }}>
                          DATASET 2 • TARGET
                        </span>
                        <span style={{
                          background: getFormatStyle(dsB.filename).bg,
                          color: getFormatStyle(dsB.filename).text,
                          fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4
                        }}>
                          {getFormatStyle(dsB.filename).ext}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <select
                          value={datasetB}
                          onChange={(e) => {
                            setDatasetB(e.target.value);
                            setAnalysis(null);
                            setPreviewData(null);
                          }}
                          style={{
                            fontSize: 11.5, color: '#525252', background: '#f4f4f4',
                            border: '1px solid #d0d0d0', borderRadius: 4, padding: '2px 6px', cursor: 'pointer'
                          }}
                          title="Change Dataset 2"
                        >
                          <option value={dsB.id}>Change: {dsB.filename}</option>
                          {availableForB.filter(d => d.id !== dsB.id).map(d => (
                            <option key={d.id} value={d.id}>{d.filename}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => {
                            setDatasetB('');
                            setAnalysis(null);
                            setPreviewData(null);
                          }}
                          style={{
                            background: '#fff', border: '1px solid #ffd7d9', color: '#da1e28',
                            borderRadius: 4, padding: '2px 6px', fontSize: 11, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 2
                          }}
                          title="Remove Dataset 2"
                        >
                          <X size={12} /> Remove
                        </button>
                      </div>
                    </div>

                    <div style={{ fontWeight: 700, fontSize: 15, color: '#161616', marginBottom: 2 }}>
                      {dsB.filename}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#6f6f6f', marginBottom: 12 }}>
                      {dsB.rows.toLocaleString()} rows · {dsB.columns} columns · {dsB.file_size_kb?.toFixed(1)} KB
                    </div>

                    <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
                      <div style={{ fontSize: 10.5, fontWeight: 600, color: '#525252', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        Columns ({dsB.column_info?.length || 0})
                      </div>
                      <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto">
                        {dsB.column_info?.map(c => (
                          <span key={c.name} style={{
                            background: '#defbe6', color: '#198038', border: '1px solid #bbf7d0',
                            padding: '2px 6px', borderRadius: 4, fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4
                          }}>
                            <strong>{c.name}</strong>
                            <span style={{ color: '#6f6f6f', fontSize: 10 }}>{c.dtype}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : availableForB.length === 0 ? (
                <div style={{
                  background: '#fafafa', border: '1.5px dashed #d0d0d0', borderRadius: 8,
                  padding: '24px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', minHeight: 220
                }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%', background: '#f4f4f4',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8d8d8d', marginBottom: 8
                  }}>
                    <Database size={18} />
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: '#161616', marginBottom: 3 }}>
                    Only 1 Active Dataset in Workspace
                  </div>
                  <div style={{ color: '#6f6f6f', fontSize: 12, marginBottom: 12, maxWidth: 280 }}>
                    Schema mapping requires two datasets. Please load or upload a second dataset from Data Sources.
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => onNavigate && onNavigate('sources')}
                    style={{ fontSize: 12, padding: '5px 12px' }}
                  >
                    Load Second Dataset <ArrowRight size={12} />
                  </Button>
                </div>
              ) : (
                <div style={{
                  background: '#f8fbff', border: '2px dashed #b0d2ff', borderRadius: 8,
                  padding: '24px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', minHeight: 220
                }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: '50%', background: '#0f62fe',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                    marginBottom: 10, boxShadow: '0 2px 6px rgba(15,98,254,0.3)'
                  }}>
                    <Plus size={20} strokeWidth={2.5} />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14.5, color: '#161616', marginBottom: 2 }}>
                    Add Dataset 2 (Target)
                  </div>
                  <div style={{ color: '#525252', fontSize: 12, marginBottom: 12, maxWidth: 280 }}>
                    Select a second active dataset to compare schemas and generate automated mappings
                  </div>

                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        setDatasetB(e.target.value);
                        setAnalysis(null);
                        setPreviewData(null);
                      }
                    }}
                    style={{
                      width: '100%', maxWidth: 300, padding: '8px 12px', borderRadius: 6,
                      border: '1.5px solid #0f62fe', background: '#fff', fontSize: 12.5,
                      fontWeight: 600, color: '#0f62fe', cursor: 'pointer', outline: 'none'
                    }}
                  >
                    <option value="">+ Select Dataset 2 ({availableForB.length} available)...</option>
                    {availableForB.map(d => (
                      <option key={d.id} value={d.id} style={{ color: '#161616', fontWeight: 400 }}>
                        {d.filename} ({d.rows} rows, {d.columns} cols)
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* AI Analysis Trigger Row */}
            <div style={{
              marginTop: 20, paddingTop: 16, borderTop: '1px solid #f0f0f0',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12
            }}>
              <div style={{ fontSize: 12, color: '#525252' }}>
                {datasetA && datasetB ? (
                  <span>
                    Ready to compare <strong>{dsA?.filename}</strong> and <strong>{dsB?.filename}</strong>.
                  </span>
                ) : (
                  <span>
                    Select both Dataset 1 and Dataset 2 to begin AI-powered schema analysis.
                  </span>
                )}
              </div>

              <Button
                variant="primary"
                onClick={handleAnalyze}
                loading={loading}
                disabled={!datasetA || !datasetB}
                style={{ padding: '8px 18px', fontSize: 13, gap: 6 }}
              >
                <Zap size={15} /> {loading ? 'Analyzing with AI...' : 'Analyze Schema with AI'}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* ===================================================================== */}
      {/* STEP 2: REVIEW MAPPINGS */}
      {/* ===================================================================== */}
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

      {/* ===================================================================== */}
      {/* STEP 3: PREVIEW */}
      {/* ===================================================================== */}
      {previewData && (
        <Card style={{ padding: 24 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#161616', marginBottom: 4 }}>
            Step 3: Merged Dataset Preview
          </div>
          <div style={{ color: '#525252', fontSize: 12.5, marginBottom: 16 }}>
            {previewData.total_rows} rows · {previewData.columns.length} columns · {joinType.toUpperCase()} JOIN
          </div>
          <DataTable data={previewData.preview} columns={previewData.columns} maxHeight={350} />
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <Alert type="success" style={{ flex: 1 }}>
              Mapping preview complete. Proceed to Transformation Studio to apply data cleaning and operations.
            </Alert>
            <Button variant="primary" onClick={() => onNavigate && onNavigate('transform')} style={{ gap: 6 }}>
              Proceed to Transformation Studio <ArrowRight size={13} />
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
