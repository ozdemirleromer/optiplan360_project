import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import CustomerLayout from './layouts/CustomerLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MyOrders from './pages/MyOrders';
import MyInvoices from './pages/MyInvoices';
import Support from './pages/Support';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Protected Customer Routes */}
        <Route element={<CustomerLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/orders" element={<MyOrders />} />
          <Route path="/invoices" element={<MyInvoices />} />
          <Route path="/support" element={<Support />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
