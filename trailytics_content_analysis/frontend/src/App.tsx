
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Assuming these are all in a 'pages' folder
import Dashboard from './pages/Dashboard';
import SkuManagement from './pages/SkuManagement';
import Tasks from './pages/Tasks';
import Reports from './pages/Reports';

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/sku-management" element={<SkuManagement />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/reports" element={<Reports />} />
        
        {/* Optional: Catch-all route to redirect unknown URLs back to the Dashboard */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

export default App;