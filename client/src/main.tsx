import { ConfigProvider } from 'antd';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { CustomerDetailPage } from './pages/CustomerDetail';
import { Dashboard } from './pages/Dashboard';
import { themeConfig } from './theme';
import { DemoConfigProvider } from './demoConfig';
import './styles.css';

function App() {
  return <BrowserRouter><DemoConfigProvider>
    <header className="app-header"><div className="header-inner">
      <Link to="/" className="brand"><span className="brand-mark">m<span>•</span></span>micro<span className="brand-light">crm</span></Link>
      <nav aria-label="Main navigation"><Link to="/" className="nav-link">Today</Link></nav>
      <div className="workspace-label"><span className="workspace-dot" />Your workspace<span className="owner-avatar" aria-label="Personal workspace">M</span></div>
    </div></header>
    <main className="app-content"><Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/customers/:id" element={<CustomerDetailPage />} />
    </Routes></main>
  </DemoConfigProvider></BrowserRouter>;
}
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><ConfigProvider theme={themeConfig}><App /></ConfigProvider></React.StrictMode>
);
