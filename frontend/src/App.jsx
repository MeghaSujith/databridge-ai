import React, { useState, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Overview from './pages/Overview';
import DataSources from './pages/DataSources';
import SchemaMapping from './pages/SchemaMapping';
import TransformationStudio from './pages/TransformationStudio';
import DataQuality from './pages/DataQuality';
import IntegrationHistory from './pages/IntegrationHistory';
import Settings from './pages/Settings';

const PAGES = {
  overview: Overview,
  sources: DataSources,
  schema: SchemaMapping,
  transform: TransformationStudio,
  quality: DataQuality,
  history: IntegrationHistory,
  settings: Settings,
};

export default function App() {
  const [page, setPage] = useState('overview');
  const [navigationParams, setNavigationParams] = useState({});
  const [datasets, setDatasets] = useState([]);

  const handleDatasetsChange = useCallback((ds) => setDatasets(ds), []);

  const handleNavigate = useCallback((targetPage, params = {}) => {
    setPage(targetPage);
    setNavigationParams(params || {});
  }, []);

  const PageComponent = PAGES[page] || Overview;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#f4f4f4' }}>
      <Sidebar activePage={page} onNavigate={(p) => handleNavigate(p, {})} />
      <main className="flex-1 overflow-y-auto">
        <PageComponent
          datasets={datasets}
          onDatasetsChange={handleDatasetsChange}
          onNavigate={handleNavigate}
          navigationParams={navigationParams}
        />
      </main>
    </div>
  );
}

