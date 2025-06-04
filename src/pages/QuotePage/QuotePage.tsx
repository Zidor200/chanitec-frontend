import React, { useRef, useEffect, useState } from 'react';
import { Box, Container, Paper, Typography, AppBar, Toolbar, Button } from '@mui/material';
import Layout from '../../components/Layout/Layout';
import QuoteHeader from '../../components/QuoteHeader/QuoteHeader';
import SuppliesSection from '../../components/SuppliesSection/SuppliesSection';
import LaborSection from '../../components/LaborSection/LaborSection';
import TotalSection from '../../components/TotalSection/TotalSection';
import QuoteActions from '../../components/QuoteActions/QuoteActions';
import { useQuote } from '../../contexts/QuoteContext';
import './QuotePage.scss';
import logo from '../../logo.png';
import { useLocation } from 'react-router-dom';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

interface QuotePageProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onLogout?: () => void;
}

const QuotePage: React.FC<QuotePageProps> = ({ currentPath, onNavigate, onLogout }) => {
  const {
    state,
    createNewQuote,
    saveQuote,
    updateQuote,
    setQuoteField,
    addSupplyItem,
    removeSupplyItem,
    addLaborItem,
    removeLaborItem,
    recalculateTotals,
    clearQuote,
    loadQuote,
    updateSupplyItem
  } = useQuote();

  const { currentQuote, isLoading, isExistingQuote, originalQuoteId } = state;
  const contentRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>;
  const location = useLocation();
  const quoteId = new URLSearchParams(location.search).get('id');

  const [isFromHistory, setIsFromHistory] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);

  // Load quote if ID is provided in URL
  useEffect(() => {
    if (quoteId && !currentQuote && !isLoading) {
      const queryParams = new URLSearchParams(window.location.search);
      const fromHistory = queryParams.get('fromHistory') === 'true';
      loadQuote(quoteId, fromHistory);
    }
  }, [quoteId, isLoading, loadQuote]);

  // Create a new quote if none exists and we're not loading one
  useEffect(() => {
    if (!currentQuote && !isLoading && !quoteId) {
      createNewQuote();
    }
  }, [currentQuote, isLoading, createNewQuote, quoteId]);

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const fromHistory = queryParams.get('fromHistory') === 'true';
    const confirmed = queryParams.get('confirmed') === 'true';
    setIsFromHistory(fromHistory);
    setIsConfirmed(confirmed);
  }, []);

  // Update isReadOnly when currentQuote changes
  useEffect(() => {
    if (currentQuote) {
      setIsReadOnly(currentQuote.confirmed || false);
      setIsConfirmed(currentQuote.confirmed || false);
    }
  }, [currentQuote]);

  // Handle home button click
  const handleHomeClick = () => {
    clearQuote();
    createNewQuote();
    onNavigate('/');
  };

  const handleConfirmQuote = async () => {
    if (!currentQuote) return;

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/quotes/${currentQuote.id}/confirm`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ confirmed: true }),
      });

      if (!response.ok) {
        throw new Error('Failed to confirm quote');
      }

      setIsConfirmed(true);
      // Show success message
      alert('Devis confirmé avec succès');
    } catch (error) {
      console.error('Error confirming quote:', error);
      alert('Erreur lors de la confirmation du devis');
    }
  };

  // If no quote is loaded or is still loading, show loading
  if (!currentQuote || isLoading) {
    return (
      <Layout currentPath={currentPath} onNavigate={onNavigate} onLogout={onLogout} onHomeClick={handleHomeClick}>
        <Box className="page-header">
          <Typography variant="h6" component="h1" className="page-title">
            CALCUL DE PRIX OFFRE CLIMATISATION
          </Typography>
        </Box>
        <Box className="loading-container">
          <Typography variant="h6">Chargement...</Typography>
        </Box>
      </Layout>
    );
  }

  return (
    <Layout currentPath={currentPath} onNavigate={onNavigate} onLogout={onLogout} onHomeClick={handleHomeClick}>
      <Box sx={{ display: 'flex', position: 'relative', width: '100%' , backgroundColor: 'white' , color: 'black',height:'20%'}} className="page-header">
        <Box sx={{ position: 'absolute', left: 0 }}>
          <img
            src={logo}
            alt="Logo"
            style={{ height: '60px' }}
          />
        </Box>
        <Box sx={{  }}>
          <Typography variant="h6" component="h1" className="page-title">
            CALCUL DE PRIX OFFRE CLIMATISATION
          </Typography>

        </Box>
      </Box>
      <Container ref={contentRef} className="quote-content">
        <QuoteHeader
          quoteId={currentQuote.id}
          clientName={currentQuote.clientName}
          siteName={currentQuote.siteName}
          object={currentQuote.object}
          date={currentQuote.date}
          onClientChange={(value) => setQuoteField('clientName', value)}
          onSiteChange={(value) => setQuoteField('siteName', value)}
          onObjectChange={(value) => setQuoteField('object', value)}
          onDateChange={(value) => setQuoteField('date', value)}
        />

        <SuppliesSection
          items={currentQuote.supplyItems}
          description={currentQuote.supplyDescription}
          exchangeRate={currentQuote.supplyExchangeRate}
          marginRate={currentQuote.supplyMarginRate}
          totalHT={currentQuote.totalSuppliesHT}
          onAddItem={addSupplyItem}
          onRemoveItem={removeSupplyItem}
          onUpdateDescription={(value) => setQuoteField('supplyDescription', value)}
          onUpdateExchangeRate={(value) => setQuoteField('supplyExchangeRate', value)}
          onUpdateMarginRate={(value) => setQuoteField('supplyMarginRate', value)}
          onUpdateSupplyItem={updateSupplyItem}
        />

        <LaborSection
          items={currentQuote.laborItems}
          description={currentQuote.laborDescription}
          exchangeRate={currentQuote.laborExchangeRate}
          marginRate={currentQuote.laborMarginRate}
          totalHT={currentQuote.totalLaborHT}
          onAddItem={addLaborItem}
          onRemoveItem={removeLaborItem}
          onUpdateDescription={(value) => setQuoteField('laborDescription', value)}
          onUpdateExchangeRate={(value) => setQuoteField('laborExchangeRate', value)}
          onUpdateMarginRate={(value) => setQuoteField('laborMarginRate', value)}
        />

        <TotalSection
          totalSuppliesHT={currentQuote.totalSuppliesHT}
          totalLaborHT={currentQuote.totalLaborHT}
          totalHT={currentQuote.totalHT}
          tva={currentQuote.tva}
          totalTTC={currentQuote.totalTTC}
        />
      </Container>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mb: 2 }}>
        {isFromHistory && (
          <Button
            variant="contained"
            startIcon={<CheckCircleOutlineIcon />}
            onClick={handleConfirmQuote}
            disabled={isConfirmed}
            sx={{
              backgroundColor: isConfirmed ? '#4caf50' : '#1976d2',
              '&:hover': {
                backgroundColor: isConfirmed ? '#4caf50' : '#1565c0',
              },
              '&.Mui-disabled': {
                backgroundColor: '#4caf50',
                color: 'white',
              }
            }}
          >
            {isConfirmed ? 'Devis Confirmé' : 'Confirmer le Devis'}
          </Button>
        )}
      </Box>

      <QuoteActions
        clientName={currentQuote.clientName}
        siteName={currentQuote.siteName}
        date={currentQuote.date}
        isExistingQuote={isExistingQuote}
        onSave={saveQuote}
        onUpdate={updateQuote}
        onViewHistory={() => onNavigate('/history')}
        contentRef={contentRef}
        onPrint={() => onNavigate(`/quote-test?id=${currentQuote.id}`)}
        onDownloadPDF={() => onNavigate(`/quote-test?id=${currentQuote.id}`)}
      />
    </Layout>
  );
};

export default QuotePage;