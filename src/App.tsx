import React, { useState, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Snackbar, Alert } from '@mui/material';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QuoteProvider } from './contexts/QuoteContext';
import QuotePage from './pages/QuotePage/QuotePage';
import HistoryPage from './pages/HistoryPage/HistoryPage';
import ClientsPage from './pages/ClientsPage/ClientsPage';
import ItemsPage from './pages/ItemsPage/ItemsPage';
import PriceOfferPage from './pages/PriceOfferPage/PriceOfferPage';
import LoginPage from './pages/LoginPage/LoginPage';
import HomePage from './pages/HomePage/HomePage';
import QuoteTest from './pages/QuoteTest/QuoteTest';
import InterventionPage from './pages/interventionPage';
import { storageService } from './services/storage-service';
import OrgChartPage from './pages/orgChartPage';
import EmployeesPage from './pages/employeesPage';
import './App.scss';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#2196f3',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: 'Roboto, Arial, sans-serif',
    h6: {
      fontWeight: 600,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 4,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 4,
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        input: {
          '&[type="number"]': {
            '-moz-appearance': 'textfield',
            padding: '8px 12px',
            paddingRight: '20px',
          },
          '&::-webkit-inner-spin-button, &::-webkit-outer-spin-button': {
            height: '100%',
            width: '20px',
            opacity: 1,
            margin: 0,
            padding: 0,
            cursor: 'pointer',
            position: 'absolute',
            right: 0,
            background: 'transparent',
            '&:hover': {
              background: 'rgba(0, 0, 0, 0.05)',
            },
            '&:active': {
              background: 'rgba(0, 0, 0, 0.1)',
            },
          },
        },
      },
    },
  },
});

// Protected Route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentPath, setCurrentPath] = useState('/');
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: 'info' as 'info' | 'success' | 'warning' | 'error'
  });
  const [priceOfferQuoteId, setPriceOfferQuoteId] = useState<string | undefined>();

  // Initialize app data
  useEffect(() => {
    // The initialization happens automatically in the StorageService constructor
    // This just checks if we should show a notification about it
    const isInitialized = localStorage.getItem('app_initialized') === 'true';
    const justInitialized = localStorage.getItem('app_just_initialized') !== 'true';

    if (isInitialized && justInitialized) {
      // Show a welcome notification
      setNotification({
        open: true,
        message: 'Données d\'exemple chargées avec succès',
        severity: 'success'
      });

      // Mark as just initialized to prevent showing notification again
      localStorage.setItem('app_just_initialized', 'true');
    }
  }, []);

  // Handle login
  const handleLogin = (username: string, password: string) => {
    if (username && password) {
      setIsAuthenticated(true);
      localStorage.setItem('isAuthenticated', 'true');
    } else {
      setNotification({
        open: true,
        message: 'Veuillez remplir tous les champs',
        severity: 'error'
      });
    }
  };

  // Handle logout
  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('isAuthenticated');
    window.location.href = '/login';
  };

  // Handle navigation
  const handleNavigate = (path: string, quoteId?: string) => {
    if (quoteId) {
      const queryParams = new URLSearchParams(window.location.search);
      const fromHistory = queryParams.get('fromHistory');
      const confirmed = queryParams.get('confirmed');

      let newPath = `${path}?id=${quoteId}`;
      if (fromHistory) newPath += `&fromHistory=${fromHistory}`;
      if (confirmed) newPath += `&confirmed=${confirmed}`;

      setPriceOfferQuoteId(quoteId);
      setCurrentPath(newPath);
      window.location.href = newPath;
    } else {
      setCurrentPath(path);
      window.location.href = path;
    }
  };

  // Close notification
  const handleCloseNotification = () => {
    setNotification({...notification, open: false});
  };

  return (
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <QuoteProvider>
          <Routes>
            <Route
              path="/login"
              element={
                isAuthenticated ?
                <Navigate to="/home" replace /> :
                <LoginPage onLogin={handleLogin} />
              }
            />

            <Route
              path="/home"
              element={
                <ProtectedRoute>
                  <HomePage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/quote"
              element={
                <ProtectedRoute>
                  <QuotePage currentPath="/quote" onNavigate={handleNavigate} onLogout={handleLogout} />
                </ProtectedRoute>
              }
            />

            <Route
              path="/quote-test"
              element={
                <ProtectedRoute>
                  <QuoteTest currentPath="/quote-test" onNavigate={handleNavigate} />
                </ProtectedRoute>
              }
            />

            <Route
              path="/history"
              element={
                <ProtectedRoute>
                  <HistoryPage currentPath="/history" onNavigate={handleNavigate} />
                </ProtectedRoute>
              }
            />

            <Route
              path="/clients"
              element={
                <ProtectedRoute>
                  <ClientsPage currentPath="/clients" onNavigate={handleNavigate} />
                </ProtectedRoute>
              }
            />

            <Route
              path="/items"
              element={
                <ProtectedRoute>
                  <ItemsPage currentPath="/items" onNavigate={handleNavigate} />
                </ProtectedRoute>
              }
            />

            <Route
              path="/price-offer"
              element={
                <ProtectedRoute>
                  <PriceOfferPage
                    currentPath="/price-offer"
                    onNavigate={handleNavigate}
                    quoteId={priceOfferQuoteId}
                  />
                </ProtectedRoute>
              }
            />

            <Route
              path="/intervention"
              element={
                <ProtectedRoute>
                  <InterventionPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/org-chart"
              element={
                <ProtectedRoute>
                  <OrgChartPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/employees"
              element={
                <ProtectedRoute>
                  <EmployeesPage />
                </ProtectedRoute>
              }
            />

            <Route path="/" element={<Navigate to="/quote" replace />} />
          </Routes>

          <Snackbar
            open={notification.open}
            autoHideDuration={6000}
            onClose={handleCloseNotification}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert
              onClose={handleCloseNotification}
              severity={notification.severity}
              sx={{ width: '100%' }}
            >
              {notification.message}
            </Alert>
          </Snackbar>
        </QuoteProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;