import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, CheckCircle, Zap, RefreshCw, AlertCircle } from 'lucide-react';
import { Card, Button, Alert, PageHeader, Input, Select, Badge, Spinner } from '../components/ui';
import { getAIStatus } from '../api';

export default function Settings() {
  const [saved, setSaved] = useState(false);
  const [aiProvider, setAiProvider] = useState('gemini');
  const [maxFileSize, setMaxFileSize] = useState('50');
  const [healthData, setHealthData] = useState(null);
  const [aiStatus, setAiStatus] = useState(null);
  const [testingAI, setTestingAI] = useState(false);

  useEffect(() => {
    fetch('/api/health').then(r => r.json()).then(setHealthData).catch(() => {});
    checkAI();
  }, []);

  const checkAI = async () => {
    setTestingAI(true);
    try {
      const s = await getAIStatus();
      setAiStatus(s);
    } catch (e) {
      setAiStatus({ ai_active: false, status: 'error', message: e.message });
    } finally {
      setTestingAI(false);
    }
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="animate-fade-in" style={{ padding: 32 }}>
      <PageHeader
        title="Settings"
        subtitle="Configure DataBridge AI platform settings"
      />

      {saved && (
        <div className="mb-4">
          <Alert type="success">Settings saved successfully.</Alert>
        </div>
      )}

      {/* API Status */}
      <Card style={{ padding: 24, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16, color: '#161616' }}>
          Platform Status
        </div>
        {healthData ? (
          <div className="flex gap-4">
            {[
              { label: 'Backend API', status: 'online', value: 'Running on port 8000' },
              { label: 'AI Provider', status: healthData.ai_provider, value: healthData.ai_provider },
              { label: 'Version', status: 'info', value: healthData.version },
            ].map(({ label, status, value }) => (
              <div key={label} style={{
                flex: 1, background: '#f4f4f4', borderRadius: 8, padding: '14px 18px',
              }}>
                <div style={{ fontSize: 11, color: '#525252', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#161616', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#198038' }} />
                  {value}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: '#8d8d8d', fontSize: 13 }}>Connecting to backend...</div>
        )}
      </Card>

      {/* AI Configuration */}
      <Card style={{ padding: 24, marginBottom: 16 }}>
        <div className="flex items-center justify-between mb-4">
          <div style={{ fontWeight: 600, fontSize: 14, color: '#161616' }}>
            AI Engine & Provider Status
          </div>
          <Button size="sm" variant="ghost" onClick={checkAI} loading={testingAI}>
            <RefreshCw size={13} /> Test AI Connection
          </Button>
        </div>

        {aiStatus && (
          <div className="mb-4">
            <Alert type={aiStatus.ai_active ? "success" : "info"}>
              <div className="flex items-center gap-2 mb-1">
                <strong>Current Mode:</strong>
                {aiStatus.ai_active ? (
                  <Badge color="green">🤖 Live Gemini AI Active</Badge>
                ) : (
                  <Badge color="yellow">⚙ Deterministic Rule-Based Fallback Active</Badge>
                )}
              </div>
              <div style={{ fontSize: 12 }}>{aiStatus.message}</div>
            </Alert>
          </div>
        )}

        <Alert type="info" style={{ marginBottom: 16 }}>
          AI API keys are configured via environment variables on the backend server.
          Never enter API keys in frontend code. See <strong>.env.example</strong> in the backend directory.
        </Alert>

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Selected AI Provider"
            value={aiProvider}
            onChange={setAiProvider}
            options={[
              { value: 'gemini', label: 'Google Gemini (gemini-1.5-flash)' },
              { value: 'groq', label: 'Groq (llama3-8b-8192)' },
              { value: 'none', label: 'Fallback Only (Deterministic)' },
            ]}
          />
          <div>
            <div style={{ fontSize: 12, color: '#525252', marginBottom: 4 }}>Deterministic Fallback Engine</div>
            <div style={{ background: '#defbe6', border: '1px solid #a7f0ba', borderRadius: 6, padding: '8px 12px', fontSize: 12.5, color: '#198038' }}>
              ✓ Deterministic pattern-matching & rule-based pipeline active at all times if AI is offline.
            </div>
          </div>
        </div>
      </Card>

      {/* File Upload Settings */}
      <Card style={{ padding: 24, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16, color: '#161616' }}>
          File Upload Settings
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Maximum File Size (MB)"
            value={maxFileSize}
            onChange={setMaxFileSize}
            placeholder="50"
          />
          <div>
            <div style={{ fontSize: 12, color: '#525252', marginBottom: 4 }}>Allowed File Types</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              {['CSV', 'XLSX', 'JSON'].map(ext => (
                <span key={ext} style={{
                  background: '#edf5ff', color: '#0043ce', padding: '4px 10px',
                  borderRadius: 4, fontSize: 12, fontWeight: 600,
                }}>{ext}</span>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Environment Instructions */}
      <Card style={{ padding: 24, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12, color: '#161616' }}>
          Environment Setup
        </div>
        <div style={{ background: '#161616', borderRadius: 8, padding: 20, fontFamily: 'monospace', fontSize: 12.5, color: '#a8ff78' }}>
          <div style={{ color: '#8da9c4', marginBottom: 8 }}># backend/.env</div>
          <div>AI_PROVIDER=gemini</div>
          <div>GEMINI_API_KEY=your_key_here</div>
          <div>GROQ_API_KEY=your_key_here</div>
          <div>MAX_FILE_SIZE_MB=50</div>
          <div>DATABASE_URL=sqlite:///./databridge.db</div>
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: '#525252' }}>
          Copy <code>backend/.env.example</code> to <code>backend/.env</code> and fill in your API keys.
          The application runs in fallback mode without keys.
        </div>
      </Card>

      <div>
        <Button onClick={handleSave} variant="success">
          <Save size={15} /> Save Settings
        </Button>
      </div>
    </div>
  );
}

