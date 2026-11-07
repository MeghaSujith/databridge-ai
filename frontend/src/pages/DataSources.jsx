import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Upload, Database, Eye, Trash2, Download, FileText,
  AlertTriangle, CheckCircle, ChevronDown, ChevronUp, RefreshCw,
  Search, Filter, ArrowRight, X, Layers, Table, Check, Sparkles, FolderCheck
} from 'lucide-react';
import {
  getDatasets, uploadDataset, previewDataset, deleteDataset,
  getSamples, loadSample, previewSample, downloadSampleUrl
} from '../api';
import {
  Card, Badge, Spinner, Button, Alert, PageHeader, DataTable, ProgressBar
} from '../components/ui';

// =============================================================================
// C. UPLOAD DATASET SECTION COMPONENT
// =============================================================================
function UploadZone({ onUploaded }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');

  const handleFiles = async (files) => {
    if (!files.length) return;
    setError('');
    setUploadSuccess('');

    for (const file of files) {
      // Validate file extension
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!['csv', 'xlsx', 'json'].includes(ext)) {
        setError(`File "${file.name}" has unsupported format .${ext}. Only CSV, XLSX, and JSON are supported.`);
        return;
      }
      // Validate file size (50 MB limit)
      if (file.size > 50 * 1024 * 1024) {
        setError(`File "${file.name}" exceeds the 50 MB limit (${(file.size / 1024 / 1024).toFixed(1)} MB).`);
        return;
      }

      setUploading(true);
      setProgress(0);
      try {
        const result = await uploadDataset(file, setProgress);
        onUploaded(result);
        setUploadSuccess(`Successfully uploaded and profiled "${result?.filename || file.name}".`);
      } catch (e) {
        setError(e.message || 'Upload failed');
      } finally {
        setUploading(false);
        setProgress(0);
      }
    }
  };

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(Array.from(e.dataTransfer.files));
  }, []);

  return (
    <Card style={{ padding: 0, overflow: 'hidden', border: `1.5px dashed ${dragging ? '#0f62fe' : '#b0d2ff'}`, transition: 'all 0.2s' }}>
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          padding: '24px 28px',
          textAlign: 'center',
          background: dragging ? '#edf5ff' : '#fcfdfe',
          cursor: 'pointer',
          transition: 'background 0.2s',
        }}
        onClick={() => document.getElementById('file-input').click()}
      >
        <input
          id="file-input"
          type="file"
          hidden
          multiple
          accept=".csv,.xlsx,.json"
          onChange={e => handleFiles(Array.from(e.target.files))}
        />
        {uploading ? (
          <div>
            <Spinner size={32} />
            <div style={{ marginTop: 10, color: '#0f62fe', fontWeight: 600, fontSize: 13 }}>
              Uploading & Profiling Dataset... {progress}%
            </div>
            <ProgressBar value={progress} style={{ marginTop: 8, maxWidth: 240, margin: '8px auto 0' }} />
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div style={{
              width: 44, height: 44, borderRadius: 8, background: '#edf5ff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 10, color: '#0f62fe', border: '1px solid #d0e2ff'
            }}>
              <Upload size={22} />
            </div>
            <div style={{ fontWeight: 600, fontSize: 14.5, color: '#161616' }}>
              Drag and drop custom datasets here, or <span style={{ color: '#0f62fe', textDecoration: 'underline' }}>browse your computer</span>
            </div>
            <div style={{ color: '#525252', fontSize: 12, marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <span style={{ background: '#defbe6', color: '#198038', padding: '1px 6px', borderRadius: 4, fontSize: 10.5, fontWeight: 600 }}>CSV</span>
              <span style={{ background: '#edf5ff', color: '#0043ce', padding: '1px 6px', borderRadius: 4, fontSize: 10.5, fontWeight: 600 }}>Excel (.xlsx)</span>
              <span style={{ background: '#fef3cd', color: '#a16207', padding: '1px 6px', borderRadius: 4, fontSize: 10.5, fontWeight: 600 }}>JSON</span>
              <span>•</span>
              <span>Max 50 MB per file</span>
              <span>•</span>
              <span>Automatic schema profiling & anomaly detection</span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div style={{ padding: '8px 16px', background: '#fff1f1', borderTop: '1px solid #ffd7d9' }}>
          <Alert type="error">{error}</Alert>
        </div>
      )}
      {uploadSuccess && (
        <div style={{ padding: '8px 16px', background: '#defbe6', borderTop: '1px solid #a7f3d0', fontSize: 12.5, color: '#198038', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Check size={14} /> {uploadSuccess}
        </div>
      )}
    </Card>
  );
}

// =============================================================================
// D. ACTIVE DATASET CARD COMPONENT
// =============================================================================
function DatasetCard({ dataset, onDelete, onNavigate }) {
  const [expanded, setExpanded] = useState(false);
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const togglePreview = async () => {
    if (!expanded) {
      setLoadingPreview(true);
      try {
        const data = await previewDataset(dataset.id);
        setPreview(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingPreview(false);
      }
    }
    setExpanded(e => !e);
  };

  const ext = dataset.filename?.split('.').pop()?.toUpperCase() || 'CSV';
  const formatBadgeColors = {
    CSV: { bg: '#defbe6', text: '#198038' },
    XLSX: { bg: '#edf5ff', text: '#0043ce' },
    JSON: { bg: '#fef3cd', text: '#a16207' },
  };
  const fmtStyle = formatBadgeColors[ext] || formatBadgeColors.CSV;

  return (
    <Card style={{ marginBottom: 10, border: '1px solid #d0d0d0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
      <div style={{ padding: '14px 18px' }}>
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div style={{
              width: 38, height: 38, borderRadius: 6, background: fmtStyle.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 11, color: fmtStyle.text, border: `1px solid ${fmtStyle.text}33`
            }}>
              {ext}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span style={{ fontWeight: 600, fontSize: 14, color: '#161616' }}>{dataset.filename}</span>
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4,
                  background: '#f4f4f4', color: '#525252', border: '1px solid #e0e0e0'
                }}>
                  Active Workspace
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: '#8d8d8d', marginTop: 2 }}>
                {dataset.rows.toLocaleString()} rows · {dataset.columns} columns · {dataset.file_size_kb?.toFixed(1)} KB
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge color={dataset.duplicate_rows > 0 ? 'yellow' : 'green'}>
              {dataset.duplicate_rows} dupes
            </Badge>
            <Badge color={dataset.missing_values > 0 ? 'red' : 'green'}>
              {dataset.missing_values} missing
            </Badge>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onNavigate && onNavigate('schema', { datasetId: dataset.id })}
              style={{ fontSize: 11.5, padding: '5px 10px', gap: 4 }}
              title="Map schema with this dataset as Primary (Dataset 1)"
            >
              Map Schema <ArrowRight size={11} />
            </Button>
            <Button variant="ghost" size="sm" onClick={togglePreview} title="Toggle data preview">
              {loadingPreview ? <Spinner size={12} /> : <Eye size={13} />}
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDelete(dataset.id)} title="Delete dataset from workspace">
              <Trash2 size={13} style={{ color: '#da1e28' }} />
            </Button>
          </div>
        </div>

        {/* Column chips */}
        <div className="flex flex-wrap gap-1" style={{ marginTop: 10 }}>
          {dataset.column_info?.slice(0, 8).map(col => (
            <span key={col.name} style={{
              background: '#f4f4f4', padding: '2px 7px', borderRadius: 4,
              fontSize: 11, color: '#525252', display: 'inline-flex', alignItems: 'center', gap: 4
            }}>
              {col.name}
              <span style={{ color: '#8d8d8d', fontSize: 10 }}>{col.dtype}</span>
              {col.missing > 0 && <span style={{ color: '#da1e28', fontSize: 10 }}>({col.missing}↑)</span>}
            </span>
          ))}
          {dataset.column_info?.length > 8 && (
            <span style={{ background: '#f4f4f4', padding: '2px 7px', borderRadius: 4, fontSize: 11, color: '#8d8d8d' }}>
              +{dataset.column_info.length - 8} more
            </span>
          )}
        </div>
      </div>

      {/* Preview */}
      {expanded && (
        <div style={{ borderTop: '1px solid #f0f0f0', padding: '0 18px 14px' }}>
          <div style={{ fontWeight: 500, fontSize: 12, color: '#525252', padding: '10px 0 6px' }}>
            Data Preview (first 10 rows)
          </div>
          {loadingPreview ? (
            <div style={{ textAlign: 'center', padding: 24 }}><Spinner /></div>
          ) : preview ? (
            <DataTable data={preview.preview} columns={preview.columns} maxHeight={280} />
          ) : null}
        </div>
      )}
    </Card>
  );
}

// =============================================================================
// SAMPLE PREVIEW MODAL
// =============================================================================
function SamplePreviewModal({ sample, onClose, onLoad, loadingLoad, activeDataset, onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sample) return;
    setLoading(true);
    previewSample(sample.id, 10)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [sample]);

  if (!sample) return null;

  const fmtColors = {
    CSV: { bg: '#defbe6', text: '#198038' },
    XLSX: { bg: '#edf5ff', text: '#0043ce' },
    JSON: { bg: '#fef3cd', text: '#a16207' },
  };
  const badge = fmtColors[sample.format] || fmtColors.CSV;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(22, 22, 22, 0.6)', backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <div style={{
        background: '#fff', borderRadius: 10, width: '100%', maxWidth: 900,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)', border: '1px solid #d0d0d0', overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 22px', borderBottom: '1px solid #e0e0e0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div className="flex items-center gap-3">
            <span style={{
              background: badge.bg, color: badge.text, padding: '3px 8px',
              borderRadius: 4, fontWeight: 700, fontSize: 11
            }}>
              {sample.format}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span style={{ fontWeight: 700, fontSize: 16, color: '#161616' }}>{sample.name}</span>
                {activeDataset && (
                  <span style={{
                    fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                    background: '#defbe6', color: '#198038', display: 'inline-flex', alignItems: 'center', gap: 3
                  }}>
                    <Check size={11} strokeWidth={2.5} /> Active in Platform
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: '#6f6f6f' }}>
                {sample.category} · {sample.rows} records · {sample.columns} columns · {sample.size_kb} KB
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: '#525252', padding: 4, borderRadius: 6
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 22px', overflowY: 'auto', flex: 1 }}>
          <p style={{ fontSize: 13, color: '#525252', marginTop: 0, marginBottom: 14 }}>
            {sample.description}
          </p>

          {sample.links_with && sample.links_with.length > 0 && (
            <div style={{
              background: '#edf5ff', border: '1px solid #b0d2ff', borderRadius: 6,
              padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#0043ce'
            }}>
              <strong>Interconnects with:</strong> {sample.links_with.join(' | ')}
            </div>
          )}

          <div style={{ fontWeight: 600, fontSize: 12.5, color: '#161616', marginBottom: 8 }}>
            Column Schema & Data Types
          </div>
          <div className="flex flex-wrap gap-1 mb-4">
            {data?.column_info?.map(c => (
              <span key={c.name} style={{
                background: '#f4f4f4', padding: '3px 8px', borderRadius: 4,
                fontSize: 11.5, color: '#393939', display: 'inline-flex', alignItems: 'center', gap: 6
              }}>
                <span style={{ fontWeight: 600 }}>{c.name}</span>
                <span style={{ color: '#8d8d8d', fontSize: 10.5 }}>{c.dtype}</span>
                {c.missing > 0 && <span style={{ color: '#da1e28', fontSize: 10 }}>({c.missing} null)</span>}
              </span>
            ))}
          </div>

          <div style={{ fontWeight: 600, fontSize: 12.5, color: '#161616', marginBottom: 8 }}>
            Sample Data Records (Preview)
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 36 }}><Spinner size={28} /></div>
          ) : data ? (
            <DataTable data={data.preview} columns={data.columns} maxHeight={260} />
          ) : (
            <div style={{ color: '#8d8d8d', fontSize: 12 }}>Unable to load preview data.</div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 22px', borderTop: '1px solid #e0e0e0', background: '#f8f9fa',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
          <div className="flex items-center gap-2">
            <a
              href={downloadSampleUrl(sample.id)}
              download
              style={{
                textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 6, fontSize: 12.5, fontWeight: 500,
                border: '1px solid #b0d2ff', background: '#fff', color: '#0043ce'
              }}
            >
              <Download size={13} /> Download File
            </a>

            {activeDataset ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  onClose();
                  onNavigate && onNavigate('schema', { datasetId: activeDataset.id });
                }}
                style={{ background: '#198038', borderColor: '#198038' }}
              >
                <Check size={13} /> Map Schema <ArrowRight size={12} />
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                loading={loadingLoad === sample.id}
                onClick={() => onLoad(sample.id)}
              >
                <Database size={13} /> Load Dataset
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN DATA SOURCES PAGE COMPONENT
// =============================================================================
export default function DataSources({ datasets, onDatasetsChange, onNavigate }) {
  const [localDatasets, setLocalDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [samples, setSamples] = useState([]);
  const [loadingSample, setLoadingSample] = useState(null);
  const [previewingSample, setPreviewingSample] = useState(null);
  const [toast, setToast] = useState(null);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedFormat, setSelectedFormat] = useState('All');

  const refresh = useCallback(() => {
    setLoading(true);
    getDatasets()
      .then(data => {
        setLocalDatasets(data);
        onDatasetsChange(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [onDatasetsChange]);

  useEffect(() => {
    refresh();
    getSamples().then(setSamples).catch(console.error);
  }, []);

  // Auto-dismiss toast notification after 6 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleUploaded = (result) => {
    refresh();
    const filename = result?.filename || 'Uploaded file';
    setToast({
      id: Date.now(),
      title: 'Dataset Uploaded Successfully',
      message: `"${filename}" is now active in your workspace.`,
      actionText: 'Map Schema',
      target: 'schema',
      datasetId: result?.id
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this dataset from active platform workspace?')) return;
    try {
      await deleteDataset(id);
      refresh();
      setToast({
        id: Date.now(),
        title: 'Dataset Removed',
        message: 'The dataset has been deleted from active workspace.',
      });
    } catch (e) {
      alert('Delete failed: ' + e.message);
    }
  };

  const handleLoadSample = async (sampleId) => {
    setLoadingSample(sampleId);
    try {
      const res = await loadSample(sampleId);
      refresh();
      if (previewingSample?.id === sampleId) {
        setPreviewingSample(null);
      }
      const loadedName = res?.filename || sampleId;
      setToast({
        id: Date.now(),
        title: 'Sample Dataset Activated',
        message: `"${loadedName}" is active and ready for Schema Mapping & Transformations.`,
        actionText: 'Map Schema',
        target: 'schema',
        datasetId: res?.id
      });
    } catch (e) {
      alert('Failed to load sample: ' + e.message);
    } finally {
      setLoadingSample(null);
    }
  };

  // Categories and formats
  const categories = ['All', 'Human Resources', 'Finance', 'Sales and Customers', 'Healthcare', 'Supply Chain and Inventory'];
  const formats = ['All', 'CSV', 'XLSX', 'JSON'];

  // ===========================================================================
  // UNIFIED SEARCH: FILTER ACTIVE DATASETS
  // ===========================================================================
  const filteredActiveDatasets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return localDatasets;
    return localDatasets.filter(d => {
      const matchFilename = d.filename?.toLowerCase().includes(q);
      const matchFormat = d.filename?.split('.').pop()?.toLowerCase().includes(q);
      const matchCols = d.column_info?.some(c => c.name?.toLowerCase().includes(q));
      return matchFilename || matchFormat || matchCols;
    });
  }, [localDatasets, searchQuery]);

  // ===========================================================================
  // UNIFIED SEARCH: FILTER SAMPLE LIBRARY DATASETS
  // ===========================================================================
  const filteredSamples = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return samples.filter(s => {
      const matchCat = selectedCategory === 'All' || s.category === selectedCategory;
      const matchFmt = selectedFormat === 'All' || s.format?.toUpperCase() === selectedFormat.toUpperCase();
      if (!matchCat || !matchFmt) return false;
      if (!q) return true;

      const matchName = s.name?.toLowerCase().includes(q);
      const matchFilename = s.filename?.toLowerCase().includes(q);
      const matchCategory = s.category?.toLowerCase().includes(q);
      const matchDesc = s.description?.toLowerCase().includes(q);
      const matchFmtText = s.format?.toLowerCase().includes(q);
      const matchLinks = s.links_with?.some(l => l.toLowerCase().includes(q));
      return matchName || matchFilename || matchCategory || matchDesc || matchFmtText || matchLinks;
    });
  }, [samples, selectedCategory, selectedFormat, searchQuery]);

  return (
    <div className="animate-fade-in" style={{ padding: '28px 32px' }}>
      {/* ===================================================================== */}
      {/* A. PAGE HEADER */}
      {/* ===================================================================== */}
      <PageHeader
        title="Data Sources"
        subtitle="Manage, upload, explore and prepare enterprise datasets for integration."
        action={
          <Button variant="ghost" size="sm" onClick={refresh}>
            <RefreshCw size={14} /> Refresh
          </Button>
        }
      />

      {/* ===================================================================== */}
      {/* B. PROMINENT UNIFIED SEARCH BAR */}
      {/* ===================================================================== */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          position: 'relative',
          background: '#fff',
          borderRadius: 8,
          border: '1.5px solid #d0d0d0',
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
          display: 'flex',
          alignItems: 'center',
          transition: 'all 0.15s ease-in-out',
        }}>
          <div style={{ paddingLeft: 14, display: 'flex', alignItems: 'center', color: '#525252' }}>
            <Search size={18} />
          </div>
          <input
            type="text"
            placeholder="Search datasets across active workspace & sample library (by name, filename, domain, format, or description)..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              padding: '12px 14px',
              border: 'none',
              outline: 'none',
              fontSize: 13.5,
              color: '#161616',
              background: 'transparent',
              borderRadius: 8,
            }}
          />
          {searchQuery && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 12 }}>
              <span style={{ fontSize: 11.5, color: '#525252', background: '#edf5ff', border: '1px solid #b0d2ff', padding: '2px 8px', borderRadius: 12 }}>
                <strong>{filteredActiveDatasets.length}</strong> active · <strong>{filteredSamples.length}</strong> samples
              </span>
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  background: '#f4f4f4',
                  border: 'none',
                  borderRadius: '50%',
                  width: 22,
                  height: 22,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#525252'
                }}
                title="Clear search"
              >
                <X size={13} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* C. UPLOAD DATASET SECTION */}
      {/* ===================================================================== */}
      <div style={{ marginBottom: 32 }}>
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <Upload size={16} color="#0f62fe" />
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#161616', margin: 0 }}>
              Upload Enterprise Dataset
            </h2>
          </div>
          <span style={{ fontSize: 12, color: '#525252' }}>
            Supports CSV, XLSX, JSON up to 50 MB
          </span>
        </div>
        <UploadZone onUploaded={handleUploaded} />
      </div>

      {/* ===================================================================== */}
      {/* D. ACTIVE PLATFORM DATASETS */}
      {/* ===================================================================== */}
      <div style={{ marginBottom: 36 }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <Database size={17} color="#0f62fe" />
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#161616', margin: 0 }}>
              Active Platform Datasets
            </h2>
            <Badge color={localDatasets.length > 0 ? 'green' : 'gray'}>
              {localDatasets.length} In Workspace
            </Badge>
            {searchQuery && (
              <span style={{ fontSize: 11.5, color: '#525252' }}>
                (Showing {filteredActiveDatasets.length} matching "{searchQuery}")
              </span>
            )}
          </div>
          {localDatasets.length >= 2 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onNavigate && onNavigate('schema', {})}
              style={{ fontSize: 12, padding: '5px 12px' }}
              title="Open Schema Mapping Studio to select datasets from scratch"
            >
              Open Schema Studio <ArrowRight size={13} />
            </Button>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 36 }}><Spinner size={28} /></div>
        ) : localDatasets.length === 0 ? (
          <Card style={{
            padding: '28px 24px', textAlign: 'center', background: '#fafafa',
            border: '1px dashed #d0d0d0', borderRadius: 8
          }}>
            <Database size={32} color="#8d8d8d" style={{ margin: '0 auto 8px' }} />
            <div style={{ color: '#161616', fontSize: 13.5, fontWeight: 600 }}>
              No Datasets Currently Loaded in Workspace
            </div>
            <div style={{ color: '#6f6f6f', fontSize: 12, marginTop: 4, maxWidth: 520, margin: '4px auto 0' }}>
              Upload enterprise files above or import from the <strong>Enterprise Sample Library</strong> below to begin.
            </div>
          </Card>
        ) : filteredActiveDatasets.length === 0 ? (
          <Card style={{
            padding: '24px 20px', textAlign: 'center', background: '#fafafa',
            border: '1px dashed #d0d0d0', borderRadius: 8
          }}>
            <div style={{ color: '#525252', fontSize: 13, fontWeight: 500 }}>
              No active workspace datasets match <strong>"{searchQuery}"</strong>
            </div>
            <button
              onClick={() => setSearchQuery('')}
              style={{
                marginTop: 8, background: '#fff', border: '1px solid #d0d0d0',
                padding: '4px 10px', borderRadius: 4, fontSize: 11.5, cursor: 'pointer', color: '#0f62fe'
              }}
            >
              Clear Search Query
            </button>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredActiveDatasets.map(ds => (
              <DatasetCard key={ds.id} dataset={ds} onDelete={handleDelete} onNavigate={onNavigate} />
            ))}
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* E. SAMPLE DATASET LIBRARY (15 DATASETS ACROSS 5 DOMAINS) */}
      {/* ===================================================================== */}
      <Card style={{ padding: '20px 24px', background: '#fff', border: '1px solid #d0e2ff', borderRadius: 10 }}>
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0043ce', margin: 0 }}>
                Enterprise Sample Dataset Library
              </h2>
              <Badge color="blue">15 Datasets</Badge>
              <span style={{
                fontSize: 10.5, fontWeight: 600, padding: '1px 6px', borderRadius: 4,
                background: '#edf5ff', color: '#0043ce', border: '1px solid #b0d2ff'
              }}>
                Built-in Templates
              </span>
            </div>
            <p style={{ fontSize: 12, color: '#525252', margin: '3px 0 0' }}>
              Multi-format enterprise datasets with cross-domain business relationships (Human Resources, Finance, Sales, Healthcare, Supply Chain)
            </p>
          </div>
          {searchQuery && (
            <span style={{ fontSize: 12, color: '#525252' }}>
              Showing {filteredSamples.length} matching samples
            </span>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3" style={{ borderBottom: '1px solid #e0e0e0' }}>
          {/* Domain Category Filter */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span style={{ fontSize: 11.5, fontWeight: 600, color: '#525252', marginRight: 4 }}>Domain:</span>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  fontSize: 11, padding: '3px 10px', borderRadius: 14, border: 'none', cursor: 'pointer',
                  fontWeight: selectedCategory === cat ? 600 : 400,
                  background: selectedCategory === cat ? '#0f62fe' : '#f4f4f4',
                  color: selectedCategory === cat ? '#fff' : '#525252',
                  boxShadow: selectedCategory === cat ? '0 1px 2px rgba(15,98,254,0.3)' : 'none',
                  transition: 'all 0.15s'
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* File Format Filter */}
          <div className="flex items-center gap-1.5">
            <span style={{ fontSize: 11.5, fontWeight: 600, color: '#525252', marginRight: 4 }}>Format:</span>
            {formats.map(fmt => (
              <button
                key={fmt}
                onClick={() => setSelectedFormat(fmt)}
                style={{
                  fontSize: 11, padding: '3px 10px', borderRadius: 14, border: 'none', cursor: 'pointer',
                  fontWeight: selectedFormat === fmt ? 600 : 400,
                  background: selectedFormat === fmt ? '#0043ce' : '#f4f4f4',
                  color: selectedFormat === fmt ? '#fff' : '#525252',
                  boxShadow: selectedFormat === fmt ? '0 1px 2px rgba(0,67,206,0.3)' : 'none',
                  transition: 'all 0.15s'
                }}
              >
                {fmt}
              </button>
            ))}
          </div>
        </div>

        {/* Dataset Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredSamples.map(s => {
            const fmtColors = {
              CSV: { bg: '#defbe6', text: '#198038', label: 'CSV' },
              XLSX: { bg: '#edf5ff', text: '#0043ce', label: 'Excel XLSX' },
              JSON: { bg: '#fef3cd', text: '#a16207', label: 'JSON' },
            };
            const fStyle = fmtColors[s.format] || fmtColors.CSV;
            const loadedCopies = localDatasets.filter(d => d.filename?.toLowerCase() === s.filename?.toLowerCase());
            const isLoaded = loadedCopies.length > 0;

            return (
              <div
                key={s.id}
                style={{
                  background: isLoaded ? '#f8fdf9' : '#fff',
                  border: isLoaded ? '1.5px solid #24a148' : '1px solid #d0e2ff',
                  borderRadius: 8,
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: isLoaded ? '0 2px 6px rgba(36,161,72,0.12)' : '0 1px 3px rgba(0,67,206,0.04)',
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                        background: fStyle.bg, color: fStyle.text
                      }}>
                        {fStyle.label}
                      </span>
                      {isLoaded && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                          background: '#defbe6', color: '#198038', display: 'inline-flex', alignItems: 'center', gap: 3
                        }}>
                          <Check size={11} strokeWidth={2.5} /> Active ({loadedCopies.length})
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 11, color: '#8d8d8d', fontWeight: 500 }}>
                      {s.category}
                    </span>
                  </div>

                  <div style={{ fontWeight: 600, fontSize: 13.5, color: '#161616', marginBottom: 4 }}>
                    {s.name}
                  </div>

                  <div style={{ fontSize: 11, color: '#6f6f6f', marginBottom: 8, display: 'flex', gap: 8 }}>
                    <span><strong>{s.rows}</strong> rows</span>
                    <span>•</span>
                    <span><strong>{s.columns}</strong> cols</span>
                    <span>•</span>
                    <span>{s.size_kb} KB</span>
                  </div>

                  <p style={{ fontSize: 11.5, color: '#525252', lineHeight: 1.4, margin: '0 0 10px' }}>
                    {s.description}
                  </p>

                  {/* Interconnect link */}
                  {s.links_with && s.links_with.length > 0 && (
                    <div style={{
                      background: '#f4f6f8', borderRadius: 4, padding: '4px 8px',
                      fontSize: 10.5, color: '#0043ce', marginBottom: 12
                    }}>
                      <span style={{ fontWeight: 600 }}>Links: </span>
                      {s.links_with[0]}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 pt-2" style={{ borderTop: '1px solid #f0f0f0' }}>
                  <button
                    onClick={() => setPreviewingSample(s)}
                    style={{
                      flex: 1, background: '#fff', color: '#525252', border: '1px solid #d0d0d0',
                      borderRadius: 4, padding: '5px 8px', fontSize: 11.5, fontWeight: 500,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4
                    }}
                    title="Inspect sample records before loading"
                  >
                    <Eye size={12} /> Preview
                  </button>

                  {isLoaded ? (
                    <>
                      <button
                        onClick={() => onNavigate && onNavigate('schema', { datasetId: loadedCopies[0]?.id })}
                        style={{
                          flex: 1.5, background: '#198038', color: '#fff', border: 'none',
                          borderRadius: 4, padding: '5px 8px', fontSize: 11.5, fontWeight: 600,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                          boxShadow: '0 1px 2px rgba(25,128,56,0.3)'
                        }}
                        title="Dataset is active! Click to open Schema Mapping with this dataset as Primary (Dataset 1)"
                      >
                        <Check size={12} /> Map Schema <ArrowRight size={11} />
                      </button>

                      <button
                        onClick={() => handleLoadSample(s.id)}
                        disabled={loadingSample === s.id}
                        style={{
                          background: '#fff', color: '#525252', border: '1px solid #d0d0d0',
                          borderRadius: 4, padding: '5px 8px', fontSize: 11, fontWeight: 500,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3
                        }}
                        title="Load another copy into platform"
                      >
                        {loadingSample === s.id ? <Spinner size={10} /> : '+ Add'}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleLoadSample(s.id)}
                      disabled={loadingSample === s.id}
                      style={{
                        flex: 1.5, background: '#0f62fe', color: '#fff', border: 'none',
                        borderRadius: 4, padding: '5px 8px', fontSize: 11.5, fontWeight: 600,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                        boxShadow: '0 1px 2px rgba(15,98,254,0.3)'
                      }}
                      title="Load this dataset into active data sources"
                    >
                      {loadingSample === s.id ? <Spinner size={11} /> : <Database size={12} />}
                      Load
                    </button>
                  )}

                  <a
                    href={downloadSampleUrl(s.id)}
                    download
                    style={{
                      background: '#edf5ff', color: '#0043ce', border: '1px solid #b0d2ff',
                      borderRadius: 4, padding: '5px 8px', fontSize: 11.5, fontWeight: 500,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      textDecoration: 'none'
                    }}
                    title="Download raw file"
                  >
                    <Download size={12} />
                  </a>
                </div>
              </div>
            );
          })}
        </div>

        {filteredSamples.length === 0 && (
          <div style={{ textAlign: 'center', padding: 36, color: '#8d8d8d', fontSize: 13 }}>
            <div>No sample datasets match <strong>"{searchQuery}"</strong> with selected filters.</div>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('All');
                setSelectedFormat('All');
              }}
              style={{
                marginTop: 10, background: '#fff', border: '1px solid #d0d0d0',
                padding: '5px 12px', borderRadius: 4, fontSize: 11.5, cursor: 'pointer', color: '#0f62fe'
              }}
            >
              Reset Search & Filters
            </button>
          </div>
        )}
      </Card>

      {/* ===================================================================== */}
      {/* PREVIEW MODAL */}
      {/* ===================================================================== */}
      {previewingSample && (
        <SamplePreviewModal
          sample={previewingSample}
          onClose={() => setPreviewingSample(null)}
          onLoad={handleLoadSample}
          loadingLoad={loadingSample}
          activeDataset={localDatasets.find(d => d.filename?.toLowerCase() === previewingSample.filename?.toLowerCase())}
          onNavigate={onNavigate}
        />
      )}

      {/* ===================================================================== */}
      {/* FLOATING ACTION TOAST NOTIFICATION */}
      {/* ===================================================================== */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 28,
          zIndex: 9999,
          background: '#161616',
          color: '#fff',
          padding: '12px 16px',
          borderRadius: 8,
          boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          maxWidth: 460,
          borderLeft: '4px solid #24a148'
        }}>
          <div style={{
            width: 26, height: 26, borderRadius: '50%', background: '#24a148',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <Check size={15} color="#fff" />
          </div>
          <div style={{ flex: 1, fontSize: 12.5, lineHeight: 1.4 }}>
            <div style={{ fontWeight: 600, color: '#f4f4f4' }}>{toast.title}</div>
            <div style={{ color: '#c6c6c6', fontSize: 11.5 }}>{toast.message}</div>
          </div>
          {toast.target && (
            <button
              onClick={() => {
                onNavigate && onNavigate(toast.target || 'schema', { datasetId: toast.datasetId });
                setToast(null);
              }}
              style={{
                background: '#0f62fe', color: '#fff', border: 'none', borderRadius: 4,
                padding: '5px 10px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0
              }}
            >
              {toast.actionText || 'Map Schema'} <ArrowRight size={11} />
            </button>
          )}
          <button
            onClick={() => setToast(null)}
            style={{
              background: 'transparent', border: 'none', color: '#8d8d8d',
              cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center'
            }}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
