import React, { useEffect, useState, useRef } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Divider,
  Button
} from '@mui/material';
import { PrintOutlined, Download } from '@mui/icons-material';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import Layout from '../../components/Layout/Layout';
import { PriceOffer } from '../../models/PriceOffer';
import { priceOfferService } from '../../services/price-offer-service';
import { apiService } from '../../services/api-service';
import './PriceOfferPage.scss';

interface PriceOfferPageProps {
  currentPath: string;
  onNavigate: (path: string, quoteId?: string) => void;
  quoteId?: string;
}

const PriceOfferPage: React.FC<PriceOfferPageProps> = ({ currentPath, onNavigate, quoteId }) => {
  const [priceOffer, setPriceOffer] = useState<PriceOffer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadPriceOffer = async () => {
      // Extract quoteId from URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      const quoteIdFromUrl = urlParams.get('id');
      console.log('Quote ID from URL:', quoteIdFromUrl);

      if (!quoteIdFromUrl) {
        setError('No quote ID provided');
        return;
      }

      try {
        // Directly fetch the quote data from the backend API
        const quote = await apiService.getQuoteById(quoteIdFromUrl);
        console.log('Fetched quote data:', quote);

        if (!quote) {
          setError('Quote not found');
          return;
        }

        // Create a new price offer from the quote
        const newOffer: PriceOffer = {
          quoteId: quote.id,
          clientName: quote.clientName,
          siteName: quote.siteName,
          object: quote.object,
          date: quote.date,
          supplyDescription: quote.supplyDescription,
          supplyTotalHT: quote.totalSuppliesHT,
          laborDescription: quote.laborDescription,
          laborTotalHT: quote.totalLaborHT,
          totalHT: quote.totalHT,
          tva: quote.tva,
          totalTTC: quote.totalTTC,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        // Save the new price offer
        const savedOffer = priceOfferService.createFromQuote(quote);
        console.log('Created and saved price offer:', savedOffer);

        setPriceOffer(savedOffer);
      } catch (error) {
        console.error('Error loading price offer:', error);
        setError('Failed to load price offer. Please try again.');
      }
    };

    loadPriceOffer();
  }, []); // Remove quoteId from dependencies since we're getting it from URL

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!contentRef.current) return;

    const canvas = await html2canvas(contentRef.current, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const imgWidth = 210; // A4 width in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
    pdf.save(`Offer de Prix_${priceOffer?.quoteId || 'unknown'}.pdf`);
  };

  if (error) {
    return (
      <Layout currentPath={currentPath} onNavigate={onNavigate}>
        <Box className="error-container">
          <Typography variant="h6" color="error">
            {error}
          </Typography>
          <Button
            variant="contained"
            onClick={() => onNavigate('/history', undefined)}
            sx={{ mt: 2 }}
          >
            Retour à l'historique
          </Button>
        </Box>
      </Layout>
    );
  }

  if (!priceOffer) {
    return (
      <Layout currentPath={currentPath} onNavigate={onNavigate}>
        <Box className="loading-container">
          <Typography variant="h6">Chargement...</Typography>
        </Box>
      </Layout>
    );
  }

  return (
    <Layout currentPath={currentPath} onNavigate={onNavigate}>
      <Container maxWidth="lg" className="price-offer-page">


        {/* Wrap the PDF content in a plain div with the ref */}
        <div ref={contentRef}>
          <Paper className="price-offer-content" elevation={2}>
            {/* Header with logos */}
            <Box className="header" sx={{ marginBottom: 4 }}>
              <img src="/logo512.png" alt="Logo" className="logo" />
              <img src="/logo chanitecc.png" alt="Chanitec Logo" className="chanitec-logo" />
            </Box>

            {/* Quote Information */}
            <Box className="quote-info-grid">
              <Box className="info-box">
                <Typography variant="subtitle2">NUMERO DEVIS</Typography>
                <Typography variant="subtitle2">CLIENT</Typography>
                <Typography variant="subtitle2">OBJET</Typography>
                <Typography variant="subtitle2">DATE</Typography>
              </Box>
              <Box className="info-box">
                <Typography variant="body1">{priceOffer.quoteId}</Typography>
                <Typography variant="body1">{priceOffer.clientName}</Typography>
                <Typography variant="body1">{priceOffer.object}</Typography>
                <Typography variant="body1">{format(new Date(priceOffer.date), 'dd/MM/yyyy')}</Typography>
              </Box>
            </Box>

            {/* Items Table */}
            <Box sx={{ mb: 4 }}>
              <table className="items-table">
                <thead>
                  <tr>
                    <th>ITEM</th>
                    <th>SERVICE / PRODUIT</th>
                    <th>DESIGNATION</th>
                    <th>QTE</th>
                    <th>P.U HT</th>
                    <th>P.T HT</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>1</td>
                    <td>Equipement</td>
                    <td>{priceOffer.supplyDescription}</td>
                    <td>1,00</td>
                    <td>{(Number(priceOffer.supplyTotalHT ?? 0)).toFixed(2)}</td>
                    <td>{(Number(priceOffer.supplyTotalHT ?? 0)).toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td>2</td>
                    <td>Prestation</td>
                    <td>{priceOffer.laborDescription}</td>
                    <td>1,00</td>
                    <td>{(Number(priceOffer.laborTotalHT ?? 0)).toFixed(2)}</td>
                    <td>{(Number(priceOffer.laborTotalHT ?? 0)).toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </Box>

            {/* Totals */}
            <Box className="totals" sx={{ mb: 4 }}>
              <Box className="total-line">
                <Typography variant="subtitle1">TOTAL USD HT</Typography>
                <Typography variant="subtitle1">TVA: 16%</Typography>
                <Typography variant="subtitle1">TOTAL USD TTC</Typography>
              </Box>
              <Box className="total-row">
                <Typography variant="body1">
                  {(Number(priceOffer.totalHT ?? 0)).toFixed(2)}
                </Typography>
                <Typography variant="body1">
                  {(Number(priceOffer.tva ?? 0)).toFixed(2)}
                </Typography>
                <Typography variant="body1" fontWeight="bold">
                  {(Number(priceOffer.totalTTC ?? 0)).toFixed(2)}
                </Typography>
              </Box>
            </Box>

            {/* Conditions */}
            <Box className="conditions" sx={{ mb: 4 }}>
              <Typography variant="h6" gutterBottom>
                Conditions:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                <Box sx={{ flex: '1 1 45%' }}>
                  <Typography style={{fontWeight: 'bold'}} variant="subtitle2">Validité de l'offre:</Typography>
                  <Typography style={{fontWeight: 'bold'}} variant="subtitle2">Garantie:</Typography>
                  <Typography style={{fontWeight: 'bold'}} variant="subtitle2">Poids / Volume:</Typography>
                  <Typography style={{fontWeight: 'bold'}} variant="subtitle2">Délai de Livraison:</Typography>
                  <Typography style={{fontWeight: 'bold'}} variant="subtitle2">Pays d'origine / provenance:</Typography>
                  <Typography style={{fontWeight: 'bold'}} variant="subtitle2">Modalité de paiement:</Typography>
                </Box>
                <Box sx={{ flex: '1 1 45%' }}>
                  <Typography style={{ marginBottom: '.5rem' }} variant="body2">14 jours à dater de l'offre</Typography>
                  <Typography style={{ marginBottom: '.5rem' }} variant="body2">N/A</Typography>
                  <Typography style={{ marginBottom: '.5rem' }} variant="body2">N/A</Typography>
                  <Typography style={{ marginBottom: '.5rem' }} variant="body2">+/- 1 jour</Typography>
                  <Typography style={{ marginBottom: '.5rem' }} variant="body2">N/A</Typography>
                  <Typography style={{ marginBottom: '.5rem' }} variant="body2">100% à la commande</Typography>
                </Box>
              </Box>
            </Box>

            <Typography style={{fontWeight: 'bold', marginBottom: '2rem',fontSize: '.8rem'}} variant="subtitle2" gutterBottom>
              NB: Après prise de RDV, le client doit faciliter l'acces au bureau/pièce concerné. Si l'intervnetion ne peut se faire faute de disponibilité, un déplacment pourra être facturé
            </Typography>

            {/* Bank Details */}
            <Box className="bank-details">
              <Typography variant="subtitle2" gutterBottom>
                PAIEMENT PAR VIREMENT BANCAIRE SUR L'UN DES COMPTES SUIVANT OU EN ESPECES A NOTRE CAISSE
              </Typography>
              <Typography variant="body2">
                BOA USD 00 029-01001-01033700012-13 EQUITYBCDC USD 00 011-00101-00000117533-24
              </Typography>
              <Typography variant="body2">
                FBN USD 00 084-84001-20300170009-55  RAWBANK USD 05 100-05101-01000022102-18
              </Typography>
              <Typography variant="body2">
                SOFIBANQUE USD 00 023-20190-01661660200-15 TMB USD 00 017-11000-50045270101-56
              </Typography>
              <Typography variant="body2">
                ECOBANK USD 00 026-00001-03600841201-27
              </Typography>
            </Box>
          </Paper>
        </div>
        <Box className="actions-bar" sx={{ mb: 2 }}>
          <Button
            variant="contained"
            startIcon={<PrintOutlined />}
            onClick={handlePrint}
            sx={{ mr: 1 }}
          >
            Imprimer
          </Button>
          <Button
            variant="contained"
            startIcon={<Download />}
            onClick={handleDownloadPDF}
            sx={{ mr: 1 }}
          >
            Télécharger PDF
          </Button>
        </Box>
      </Container>
    </Layout>
  );
};

export default PriceOfferPage;