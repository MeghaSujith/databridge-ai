import React, { useEffect, useState } from 'react';
import {
  Wand2, Play, Plus, Trash2, ChevronDown, ChevronUp, Zap, CheckCircle, AlertCircle
} from 'lucide-react';
import { getDatasets, getAIPlan, transformPreview, transformExecute } from '../api';
import {
  Card, Badge, Spinner, Button, Alert, PageHeader,
  Select, Input, DataTable, StatusBadge
} from '../components/ui';

const OPERATIONS = [
  { value: 'join',         label: 'JOIN datasets' },
  { value: 'deduplicate',  label: 'Remove duplicates' },
  { value: 'fill_missing', label: 'Handle missing values' },
  { value: 'rename',       label: 'Rename columns' },
  { value: 'filter',       label: 'Filter records' },
  { value: 'sort',         label: 'Sort records' },
  { value: 'standardize',  label: 'Standardize text' },
  { value: 'type_convert', label: 'Convert data type' },
];

function OperationRow({ op, datasets, onUpdate, onRemove, primaryDataset, secondaryDataset }) {
  const cols = primaryDataset?.column_info?.map(c => c.name) || [];
  const colOptions = [{ value: '', label: 'Select column...' }, ...cols.map(c => ({ value: c, label: c }))];

  const updateParam = (key, value) => onUpdate({ ...op, params: { ...op.params, [key]: value } });

  return (
    <div style={{
      border: '1px solid #e0e0e0', borderRadius: 8, padding: 16, marginBottom: 8,
      background: '#fafafa',
    }}>
      <div className="flex items-center gap-3 mb-3">
        <div style={{
          width: 24, height: 24, borderRadius: 4, background: '#0f62fe',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700,
        }}>
          {op.step}
        </div>
        <Select
          value={op.operation}
          onChange={v => onUpdate({ ...op, operation: v, params: {} })}
          options={OPERATIONS}
          style={{ minWidth: 180 }}
        />
        <div style={{ flex: 1 }} />
        <button onClick={onRemove} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#da1e28' }}>
          <Trash2 size={15} />
        </button>
      </div>

      {/* Params per operation type */}
      {op.operation === 'join' && (
        <div className="grid grid-cols-3 gap-3">
          <Select label="Join Type" value={op.params.join_type || 'inner'} onChange={v => updateParam('join_type', v)}
            options={[{ value: 'inner', label: 'INNER' }, { value: 'left', label: 'LEFT' }, { value: 'right', label: 'RIGHT' }, { value: 'outer', label: 'OUTER' }]}
          />
          <Select label="Left Key" value={op.params.left_key || ''} onChange={v => updateParam('left_key', v)} options={colOptions} />
          <Select label="Right Key" value={op.params.right_key || ''} onChange={v => updateParam('right_key', v)}
            options={[{ value: '', label: 'Select column...' }, ...(secondaryDataset?.column_info?.map(c => ({ value: c.name, label: c.name })) || [])]}
          />
        </div>
      )}

      {op.operation === 'fill_missing' && (
        <Select label="Strategy" value={op.params.strategy || 'mean_or_unknown'} onChange={v => updateParam('strategy', v)}
          options={[
            { value: 'mean_or_unknown', label: 'Mean (numeric) / "Unknown" (text)' },
            { value: 'mean', label: 'Mean (numeric only)' },
            { value: 'median', label: 'Median (numeric only)' },
            { value: 'drop', label: 'Drop rows with missing values' },
          ]}
          style={{ maxWidth: 320 }}
        />
      )}

      {op.operation === 'filter' && (
        <div className="grid grid-cols-3 gap-3">
          <Select label="Column" value={op.params.column || ''} onChange={v => updateParam('column', v)} options={colOptions} />
          <Select label="Operator" value={op.params.operator || 'eq'} onChange={v => updateParam('operator', v)}
            options={[{ value: 'eq', label: '==' }, { value: 'ne', label: '!=' }, { value: 'gt', label: '>' },
              { value: 'lt', label: '<' }, { value: 'contains', label: 'contains' }]}
          />
          <Input label="Value" value={op.params.value || ''} onChange={v => updateParam('value', v)} placeholder="Filter value" />
        </div>
      )}

      {op.operation === 'sort' && (
        <div className="grid grid-cols-2 gap-3">
          <Select label="Column" value={op.params.column || ''} onChange={v => updateParam('column', v)} options={colOptions} />
          <Select label="Order" value={op.params.ascending !== false ? 'asc' : 'desc'} onChange={v => updateParam('ascending', v === 'asc')}
            options={[{ value: 'asc', label: 'Ascending' }, { value: 'desc', label: 'Descending' }]}
          />
        </div>
      )}

      {op.operation === 'standardize' && (
        <div className="grid grid-cols-2 gap-3">
          <Select label="Column" value={op.params.column || ''} onChange={v => updateParam('column', v)} options={colOptions} />
          <Select label="Mode" value={op.params.mode || 'lower'} onChange={v => updateParam('mode', v)}
            options={[{ value: 'lower', label: 'Lowercase' }, { value: 'upper', label: 'Uppercase' }, { value: 'title', label: 'Title Case' }]}
          />
        </div>
      )}

      {op.operation === 'type_convert' && (
        <div className="grid grid-cols-2 gap-3">
          <Select label="Column" value={op.params.column || ''} onChange={v => updateParam('column', v)} options={colOptions} />
          <Select label="Target Type" value={op.params.to_type || 'str'} onChange={v => updateParam('to_type', v)}
            options={[{ value: 'str', label: 'String' }, { value: 'int', label: 'Integer' }, { value: 'float', label: 'Float' }, { value: 'datetime', label: 'Datetime' }]}
          />
        </div>
      )}

      {op.operation === 'rename' && (
        <div>
          <div style={{ fontSize: 12, color: '#525252', marginBottom: 6 }}>Column rename map (old → new):</div>
          {Object.entries(op.params.columns || {}).map(([k, v], i) => (
            <div key={i} className="flex gap-2 mb-2">
              <select value={k} onChange={e => {
                const newMap = { ...op.params.columns };
                delete newMap[k];
                newMap[e.target.value] = v;
                updateParam('columns', newMap);
              }} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #e0e0e0', fontSize: 12 }}>
                {cols.map(c => <option key={c}>{c}</option>)}
              </select>
              <span style={{ padding: '4px 6px', fontSize: 12, color: '#8d8d8d' }}>→</span>
              <input value={v} onChange={e => updateParam('columns', { ...op.params.columns, [k]: e.target.value })}
                style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #e0e0e0', fontSize: 12, flex: 1 }} />
            </div>
          ))}
          <Button size="sm" variant="ghost" onClick={() => updateParam('columns', { ...op.params.columns, [cols[0] || '']: '' })}>
            <Plus size={12} /> Add rename rule
          </Button>
        </div>
      )}

      {op.operation === 'deduplicate' && (
        <div style={{ fontSize: 12, color: '#525252' }}>
          Will remove exact duplicate rows from the dataset.
        </div>
      )}
    </div>
  );
}

export default function TransformationStudio() {
  const [datasets, setDatasets] = useState([]);
  const [primaryId, setPrimaryId] = useState('');
  const [secondaryId, setSecondaryId] = useState('');
  const [operations, setOperations] = useState([]);
  const [nlInstruction, setNlInstruction] = useState('');
  const [planLoading, setPlanLoading] = useState(false);
  const [plan, setPlan] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [executeLoading, setExecuteLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [jobName, setJobName] = useState('');
  const [error, setError] = useState('');
  const [tab, setTab] = useState('manual'); // 'manual' | 'ai'

  useEffect(() => {
    getDatasets().then(setDatasets).catch(console.error);
  }, []);

  const dsOptions = [{ value: '', label: 'None' }, ...datasets.map(d => ({ value: d.id, label: d.filename }))];
  const primaryDs = datasets.find(d => d.id === primaryId);
  const secondaryDs = datasets.find(d => d.id === secondaryId);

  const addOperation = () => {
    setOperations(ops => [...ops, {
      step: ops.length + 1,
      operation: 'deduplicate',
      description: '',
      params: {},
    }]);
  };

  const updateOperation = (i, op) => {
    setOperations(ops => ops.map((o, idx) => idx === i ? op : o));
  };

  const removeOperation = (i) => {
    setOperations(ops => ops.filter((_, idx) => idx !== i).map((o, idx) => ({ ...o, step: idx + 1 })));
  };

  const handleGetAIPlan = async () => {
    setError('');
    if (!primaryId) return setError('Select at least one dataset.');
    if (!nlInstruction.trim()) return setError('Enter a description of what you want to do.');
    setPlanLoading(true);
    try {
      const ids = [primaryId, ...(secondaryId ? [secondaryId] : [])];
      const result = await getAIPlan({ instruction: nlInstruction, dataset_ids: ids });
      setPlan(result);
      setOperations(result.plan.steps.map(s => ({ ...s, params: s.params || {} })));
    } catch (e) {
      setError(e.message);
    } finally {
      setPlanLoading(false);
    }
  };

  const handlePreview = async () => {
    setError('');
    setPreviewLoading(true);
    try {
      const result = await transformPreview({
        dataset_a_id: primaryId,
        dataset_b_id: secondaryId || undefined,
        operations,
        join_key_a: operations.find(o => o.operation === 'join')?.params?.left_key || '',
        join_key_b: operations.find(o => o.operation === 'join')?.params?.right_key || '',
        join_type: operations.find(o => o.operation === 'join')?.params?.join_type || 'inner',
      });
      setPreview(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!jobName.trim()) return setError('Please enter a job name.');
    setError('');
    setExecuteLoading(true);
    try {
      const result = await transformExecute({
        name: jobName,
        dataset_a_id: primaryId,
        dataset_b_id: secondaryId || undefined,
        operations,
        join_key_a: operations.find(o => o.operation === 'join')?.params?.left_key || '',
        join_key_b: operations.find(o => o.operation === 'join')?.params?.right_key || '',
        join_type: operations.find(o => o.operation === 'join')?.params?.join_type || 'inner',
      });
      setResult(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setExecuteLoading(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ padding: 32 }}>
      <PageHeader
        title="Transformation Studio"
        subtitle="Build and execute data transformation pipelines with AI assistance"
      />

      {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}

      {/* Dataset selection */}
      <Card style={{ padding: 24, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16, color: '#161616' }}>
          Dataset Selection
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select label="Primary Dataset *" value={primaryId} onChange={setPrimaryId} options={dsOptions} />
          <Select label="Secondary Dataset (for joins)" value={secondaryId} onChange={setSecondaryId} options={dsOptions} />
        </div>
      </Card>

      {/* Tab: Manual vs AI */}
      <div className="flex gap-2 mb-4">
        {['manual', 'ai'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 18px', borderRadius: 6, border: '1px solid',
            borderColor: tab === t ? '#0f62fe' : '#e0e0e0',
            background: tab === t ? '#0f62fe' : '#fff',
            color: tab === t ? '#fff' : '#525252',
            fontWeight: tab === t ? 600 : 400,
            fontSize: 13, cursor: 'pointer',
          }}>
            {t === 'manual' ? '⚙ Manual Pipeline' : '🤖 AI-Assisted Planning'}
          </button>
        ))}
      </div>

      {/* AI Planning Tab */}
      {tab === 'ai' && (
        <Card style={{ padding: 24, marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12, color: '#161616' }}>
            Describe Your Integration Goal
          </div>
          <textarea
            value={nlInstruction}
            onChange={e => setNlInstruction(e.target.value)}
            placeholder='Example: "Combine the employee and payroll datasets using employee ID. Remove duplicates and handle missing salary values."'
            style={{
              width: '100%', height: 100, padding: 12, borderRadius: 8,
              border: '1px solid #e0e0e0', fontSize: 13, resize: 'vertical',
              fontFamily: 'inherit', outline: 'none',
            }}
            onFocus={e => e.target.style.borderColor = '#0f62fe'}
            onBlur={e => e.target.style.borderColor = '#e0e0e0'}
          />
          <div style={{ marginTop: 10 }}>
            <Button onClick={handleGetAIPlan} loading={planLoading} disabled={!primaryId}>
              <Zap size={15} /> {planLoading ? 'Generating Plan...' : 'Generate Transformation Plan'}
            </Button>
          </div>
          {plan && (
            <div style={{ marginTop: 16 }}>
              <div className="flex items-center gap-2 mb-2">
                {plan.plan.ai_generated ? (
                  <Badge color="blue">🤖 Plan Generated by Gemini AI</Badge>
                ) : (
                  <Badge color="yellow">⚙ Deterministic Rule-Based Fallback Plan</Badge>
                )}
              </div>
              <Alert type={plan.plan.ai_generated ? "info" : "warning"}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{plan.plan.summary}</div>
                {plan.plan.warnings?.length > 0 && (
                  <ul style={{ margin: '6px 0 0', paddingLeft: 16 }}>
                    {plan.plan.warnings.map((w, i) => <li key={i} style={{ fontSize: 11.5 }}>{w}</li>)}
                  </ul>
                )}
              </Alert>
            </div>
          )}
        </Card>
      )}

      {/* Operations Pipeline */}
      <Card style={{ padding: 24, marginBottom: 16 }}>
        <div className="flex items-center justify-between mb-4">
          <div style={{ fontWeight: 600, fontSize: 14, color: '#161616' }}>
            Transformation Pipeline
          </div>
          <Button size="sm" variant="secondary" onClick={addOperation}>
            <Plus size={13} /> Add Step
          </Button>
        </div>

        {operations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#8d8d8d', fontSize: 13 }}>
            No operations defined. Add a step or use AI planning above.
          </div>
        ) : (
          operations.map((op, i) => (
            <OperationRow
              key={i} op={op} datasets={datasets}
              primaryDataset={primaryDs}
              secondaryDataset={secondaryDs}
              onUpdate={updated => updateOperation(i, updated)}
              onRemove={() => removeOperation(i)}
            />
          ))
        )}

        <div className="flex gap-3 mt-4">
          <Button variant="secondary" onClick={handlePreview} loading={previewLoading}
            disabled={!primaryId || operations.length === 0}>
            <Play size={14} /> Preview
          </Button>
        </div>
      </Card>

      {/* Preview Result */}
      {preview && (
        <Card style={{ padding: 24, marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, color: '#161616' }}>
            Transformation Preview
          </div>
          <div className="flex gap-4 mb-4" style={{ fontSize: 12.5, color: '#525252' }}>
            <span>Before: <strong>{preview.before_rows}</strong> rows</span>
            <span>After: <strong>{preview.after_rows}</strong> rows</span>
            <span style={{ color: preview.rows_removed > 0 ? '#198038' : '#8d8d8d' }}>
              Removed: <strong>{preview.rows_removed}</strong>
            </span>
          </div>
          <DataTable data={preview.preview} columns={preview.columns} maxHeight={300} />
        </Card>
      )}

      {/* Execute */}
      {preview && (
        <Card style={{ padding: 24, marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16, color: '#161616' }}>
            Execute Integration Job
          </div>
          <div className="flex gap-3">
            <Input
              value={jobName}
              onChange={setJobName}
              placeholder="e.g. Employee-Payroll Q4 2024"
              label="Job Name *"
              style={{ flex: 1 }}
            />
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <Button variant="success" onClick={handleExecute} loading={executeLoading} size="lg">
                <Play size={16} /> Execute Integration
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Result */}
      {result && (
        <Card style={{ padding: 24 }}>
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle size={20} color="#198038" />
            <div style={{ fontWeight: 600, fontSize: 15, color: '#198038' }}>Integration Complete!</div>
          </div>
          <div className="grid grid-cols-4 gap-4 mb-4">
            {[
              { label: 'Input Records', value: result.records_input },
              { label: 'Output Records', value: result.records_output },
              { label: 'Duplicates Removed', value: result.duplicates_removed },
              { label: 'Quality Score', value: `${result.quality_score}%` },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: '#f4f4f4', borderRadius: 8, padding: '12px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#161616' }}>{value}</div>
                <div style={{ fontSize: 11.5, color: '#525252', marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            {['csv', 'xlsx', 'json'].map(fmt => (
              <a key={fmt} href={`/api/integrations/${result.id}/export?fmt=${fmt}`} download>
                <Button size="sm" variant="secondary">.{fmt.toUpperCase()}</Button>
              </a>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <DataTable data={result.preview} columns={result.columns} maxHeight={250} />
          </div>
        </Card>
      )}
    </div>
  );
}

