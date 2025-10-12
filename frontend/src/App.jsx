import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import LoanRequestPage from './pages/LoanRequestPage';
import LoanDashboard from './pages/LoanDashboard';
import PayrollConnectPage from './pages/PayrollConnectPage';
import LoanBorrowerFlow from './pages/LoanBorrowerFlow';

function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="request" element={<LoanRequestPage />} />
          <Route path="dashboard" element={<LoanDashboard />} />
          <Route path="payroll" element={<PayrollConnectPage />} />
          <Route path="loan-borrower" element={<LoanBorrowerFlow />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
