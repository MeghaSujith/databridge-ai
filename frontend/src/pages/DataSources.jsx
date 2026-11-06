import React, { useEffect, useState, useCallback } from 'react';
import {
  Upload, Database, Eye, Trash2, Download, FileText,
  AlertTriangle, CheckCircle, ChevronDown, ChevronUp, RefreshCw
} from 'lucide-react';
import { getDatasets, uploadDataset, previewDataset, deleteDataset, getSamples, loadSample } from '../api';
import {
  Card, Badge, Spinner, Button, Alert, PageHeader, DataTable, ProgressBar
} from '../components/ui';

function UploadZone({ onUploaded }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const handleFiles = async (files) => {
    if (!files.length) return;
    setError('');
    for (const file of files) {
      setUploading(true);
      setProgress(0);
      try {
        const result = await uploadDataset(file, setProgress);
        onUploaded(result);
      } catch (e) {
        setError(e.message);
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
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          border: `2px dashed ${dragging ? '#0f62fe' : '#d0e2ff'}`,
          borderRadius: 10,
          padding: 40,
          textAlign: 'center',
          background: dragging ? '#edf5ff' : '#f8fbff',
          transition: 'all 0.2s',
          cursor: 'pointer',
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
            <Spinner size={36} />
            <div style={{ marginTop: 12, color: '#0f62fe', fontWeight: 500 }}>
              Uploading... {progress}%
            </div>
            <ProgressBar value={progress} style={{ marginTop: 8, maxWidth: 200, margin: '8px auto 0' }} />
          </div>
        ) : (
          <>
            <Upload size={36} color="#0f62fe" style={{ margin: '0 auto 12px' }} />
            <div style={{ fontWeight: 600, fontSize: 15, color: '#161616' }}>
              Drop files here or click to upload
            </div>
            <div style={{ color: '#525252', fontSize: 12.5, marginTop: 6 }}>
              Supports CSV, Excel (.xlsx), JSON · Max 50 MB per file
            </div>
          </>
        )}
      </div>
      {error && (
        <div style={{ padding: '12px 16px' }}>
          <Alert type="error">{error}</Alert>
        </div>
      )}
    </Card>
  );
}

function DatasetCard({ dataset, onDelete, onPreview }) {
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

  const qualityColor = dataset.missing_values === 0 && dataset.duplicate_rows === 0
    ? '#198038' : dataset.missing_values < 5 ? '#f1c21b' : '#da1e28';

  return (
    <Card style={{ marginBottom: 12 }}>
      <div style={{ padding: '16px 20px' }}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div style={{
              width: 40, height: 40, borderRadius: 8, background: '#edf5ff',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <FileText size={20} color="#0f62fe" />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#161616' }}>{dataset.filename}</div>
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
            <Button variant="ghost" size="sm" onClick={togglePreview}>
              {loadingPreview ? <Spinner size={12} /> : <Eye size={13} />}
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDelete(dataset.id)}>
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
        <div style={{ borderTop: '1px solid #f0f0f0', padding: '0 20px 16px' }}>
          <div style={{ fontWeight: 500, fontSize: 12, color: '#525252', padding: '12px 0 8px' }}>
            Data Preview (first 10 rows)
          </div>
          {loadingPreview ? (
            <div style={{ textAlign: 'center', padding: 24 }}><Spinner /></div>
          ) : preview ? (
            <DataTable data={preview.preview} columns={preview.columns} maxHeight={300} />
          ) : null}
        </div>
      )}
    </Card>
  );
}

export default function DataSources({ datasets, onDatasetsChange }) {
  const [localDatasets, setLocalDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [samples, setSamples] = useState([]);

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

  const handleUploaded = (ds) => {
    refresh();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this dataset?')) return;
    try {
      await deleteDataset(id);
      refresh();
    } catch (e) {
      alert('Delete failed: ' + e.message);
    }
  };

  const [loadingSample, setLoadingSample] = useState(null);

  const handleLoadSample = async (sampleId) => {
    setLoadingSample(sampleId);
    try {
      await loadSample(sampleId);
      refresh();
    } catch (e) {
      alert('Failed to load sample: ' + e.message);
    } finally {
      setLoadingSample(null);
    }
  };

  const downloadSample = (sampleId) => {
    window.open(`/api/datasets/${sampleId}/sample`, '_blank');
  };

  return (
    <div className="animate-fade-in" style={{ padding: 32 }}>
      <PageHeader
        title="Data Sources"
        subtitle="Upload and manage your enterprise datasets"
        action={
          <Button variant="ghost" size="sm" onClick={refresh}>
            <RefreshCw size={14} /> Refresh
          </Button>
        }
      />

      {/* Sample Downloads */}
      <Card style={{ padding: '16px 20px', marginBottom: 20, background: '#edf5ff', border: '1px solid #b0d2ff' }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: '#0043ce', marginBottom: 10 }}>
          📦 Sample Datasets for Demo
        </div>
        <div className="flex gap-3 flex-wrap">
          {samples.map(s => (
            <div
              key={s.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: '#fff', border: '1px solid #b0d2ff',
                borderRadius: 6, padding: '6px 12px',
              }}
            >
              <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0043ce' }}>{s.name}</div>
              <span style={{ color: '#525252', fontSize: 11 }}>{s.description}</span>
              <div className="flex items-center gap-1 ml-auto">
                <button
                  onClick={() => handleLoadSample(s.id)}
                  disabled={loadingSample === s.id}
                  style={{
                    background: '#0f62fe', color: '#fff', border: 'none',
                    borderRadius: 4, padding: '3px 8px', fontSize: 11, fontWeight: 500,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                  }}
                  title="Import directly into platform"
                >
                  {loadingSample === s.id ? <Spinner size={10} /> : <Database size={11} />}
                  Load
                </button>
                <button
                  onClick={() => downloadSample(s.id)}
                  style={{
                    background: '#edf5ff', color: '#0043ce', border: '1px solid #b0d2ff',
                    borderRadius: 4, padding: '3px 8px', fontSize: 11, fontWeight: 500,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                  }}
                  title="Download CSV to disk"
                >
                  <Download size={11} /> Download
                </button>
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: '#525252', marginTop: 8 }}>
          Click <strong>Load</strong> to instantly import realistic demo data, or <strong>Download</strong> to test manual drag-and-drop.
        </div>
      </Card>

      <UploadZone onUploaded={handleUploaded} />

      <div style={{ marginTop: 24 }}>
        <div className="flex items-center gap-3 mb-4">
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#161616', margin: 0 }}>
            Uploaded Datasets
          </h2>
          <Badge color="blue">{localDatasets.length}</Badge>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spinner size={28} /></div>
        ) : localDatasets.length === 0 ? (
          <Card style={{ padding: 40, textAlign: 'center' }}>
            <Database size={40} color="#c1c1c1" style={{ margin: '0 auto 12px' }} />
            <div style={{ color: '#8d8d8d', fontSize: 14 }}>No datasets uploaded yet</div>
            <div style={{ color: '#c1c1c1', fontSize: 12, marginTop: 4 }}>
              Upload CSV, Excel, or JSON files to get started
            </div>
          </Card>
        ) : (
          localDatasets.map(ds => (
            <DatasetCard key={ds.id} dataset={ds} onDelete={handleDelete} />
          ))
        )}
      </div>
    </div>
  );
}

