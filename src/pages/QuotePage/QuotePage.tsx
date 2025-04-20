import React, { useRef, useEffect } from 'react';
import { Box, Container, Paper, Typography, AppBar, Toolbar } from '@mui/material';
import Layout from '../../components/Layout/Layout';
import QuoteHeader from '../../components/QuoteHeader/QuoteHeader';
import SuppliesSection from '../../components/SuppliesSection/SuppliesSection';
import LaborSection from '../../components/LaborSection/LaborSection';
import TotalSection from '../../components/TotalSection/TotalSection';
import QuoteActions from '../../components/QuoteActions/QuoteActions';
import { useQuote } from '../../contexts/QuoteContext';
import './QuotePage.scss';
import logo from '../../logo.png';
interface QuotePageProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

const QuotePage: React.FC<QuotePageProps> = ({ currentPath, onNavigate }) => {
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
    clearQuote
  } = useQuote();

  const { currentQuote, isLoading, isExistingQuote } = state;
  const contentRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>;

  // Create a new quote if none exists
  useEffect(() => {
    if (!currentQuote) {
      createNewQuote();
    }
  }, [currentQuote, createNewQuote]);

  // Navigate to history page
  const handleViewHistory = () => {
    onNavigate('/history');
  };

  // Handle home button click
  const handleHomeClick = () => {
    clearQuote();
    createNewQuote();
  };

  // If no quote is loaded or is still loading, show loading
  if (!currentQuote || isLoading) {
    return (
      <Layout currentPath={currentPath} onNavigate={onNavigate} onHomeClick={handleHomeClick}>
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
    <Layout currentPath={currentPath} onNavigate={onNavigate} onHomeClick={handleHomeClick}>
      <Box sx={{ display: 'flex', position: 'relative', width: '100%' , backgroundColor: 'white' , color: 'black'}} className="page-header">
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

      <QuoteActions
        clientName={currentQuote.clientName}
        siteName={currentQuote.siteName}
        date={currentQuote.date}
        isExistingQuote={isExistingQuote}
        onSave={saveQuote}
        onUpdate={updateQuote}
        onViewHistory={handleViewHistory}
        contentRef={contentRef}
      />
    </Layout>
  );
};

export default QuotePage;