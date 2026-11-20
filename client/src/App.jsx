import { Route, Routes } from 'react-router-dom';
import AppLayout from './layouts/AppLayout.jsx';
import AboutPage from './pages/AboutPage.jsx';
import AnalyzePage from './pages/AnalyzePage.jsx';
import AuditHistoryPage from './pages/AuditHistoryPage.jsx';
import AuditResultPage from './pages/AuditResultPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import OverviewPage from './pages/OverviewPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/analyze" element={<AnalyzePage />} />
        <Route path="/audits/:id" element={<AuditResultPage />} />
        <Route path="/history" element={<AuditHistoryPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
