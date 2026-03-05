import React from 'react'

import ReactDOM from 'react-dom/client'

import App from './App'

import { DemoDesktopPage } from './pages/DemoDesktopPage'

import './index.css'

import { ErrorBoundary } from './components/Shared/ErrorBoundary'



// Check for demo mode
const params = new URLSearchParams(window.location.search);
const isDemoMode = params.get('page') === 'optiplan-desktop';

const content = isDemoMode ? <DemoDesktopPage /> : <App />;

ReactDOM.createRoot(document.getElementById('root')!).render(

  <React.StrictMode>

    <ErrorBoundary>

      {content}

    </ErrorBoundary>

  </React.StrictMode>,

)

