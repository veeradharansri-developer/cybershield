import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SessionProvider } from './context/SessionContext';
import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import UploadPage from './pages/UploadPage';
import CleanPage from './pages/CleanPage';
import OverviewPage from './pages/OverviewPage';
import EDAPage from './pages/EDAPage';
import CorrelationPage from './pages/CorrelationPage';
import HypothesisPage from './pages/HypothesisPage';
import AnomalyPage from './pages/AnomalyPage';
import InvestigatePage from './pages/InvestigatePage';
import ProfilePage from './pages/ProfilePage';
import ReportPage from './pages/ReportPage';

function AppLayout() {
  return (
    <div className="min-h-screen bg-[#060b14]">
      <Navbar />
      <main className="pt-14">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/clean" element={<CleanPage />} />
          <Route path="/overview" element={<OverviewPage />} />
          <Route path="/eda" element={<EDAPage />} />
          <Route path="/correlation" element={<CorrelationPage />} />
          <Route path="/hypothesis" element={<HypothesisPage />} />
          <Route path="/anomaly" element={<AnomalyPage />} />
          <Route path="/investigate" element={<InvestigatePage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/report" element={<ReportPage />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </SessionProvider>
  );
}

export default App;
