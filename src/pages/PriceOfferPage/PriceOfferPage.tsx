import React, { useEffect, useState, useRef } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Divider,
  Button
} from '@mui/material';
import { PrintOutlined, GetApp as DownloadIcon, Margin } from '@mui/icons-material';
import { format } from 'date-fns';
import { usePDF } from 'react-to-pdf';
import Layout from '../../components/Layout/Layout';
import { PriceOffer } from '../../models/PriceOffer';
import { priceOfferService } from '../../services/price-offer-service';
import './PriceOfferPage.scss';

interface PriceOfferPageProps {
  currentPath: string;
  onNavigate: (path: string, quoteId?: string) => void;
  quoteId?: string;
}

const PriceOfferPage: React.FC<PriceOfferPageProps> = ({ currentPath, onNavigate, quoteId }) => {
  const [priceOffer, setPriceOffer] = useState<PriceOffer | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const { toPDF } = usePDF();

  useEffect(() => {
    if (quoteId) {
      const offer = priceOfferService.getByQuoteId(quoteId);
      if (offer) {
        setPriceOffer(offer);
      } else {
        onNavigate('/history', undefined);
      }
    }
  }, [quoteId, onNavigate]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    if (contentRef.current) {
      toPDF({
        filename: `price-offer-${priceOffer?.quoteId}.pdf`,
        page: { format: 'a4' }
      });
    }
  };

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
            startIcon={<DownloadIcon />}
            onClick={handleDownloadPDF}
          >
            Télécharger PDF
          </Button>
        </Box>

        <Paper ref={contentRef} className="price-offer-content" elevation={2}>
          {/* Header with logos */}
          <Box className="header" sx={{ marginBottom: 4 }}>
            <img src="/logo512.png" alt="Logo" className="logo" />

            <img src="/logo chanitecc.png" alt="Chanitec Logo" className="chanitec-logo " />
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
              {format(new Date(priceOffer.date), 'dd/MM/yyyy')}
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
          <tr className="totals" >
                <td className="total-line">
                  <Typography variant="subtitle1">TOTAL USD HT</Typography>
                  <Typography variant="subtitle1">TVA: 16%</Typography>
                  <Typography variant="subtitle1">TOTAL USD TTC</Typography>

                </td>
                <td className="total-row">
                <Typography variant="body1">
                    {(Number(priceOffer.totalHT ?? 0)).toFixed(2)}
                  </Typography>
                  <Typography variant="body1">
                    {(Number(priceOffer.tva ?? 0)).toFixed(2)}
                  </Typography>
                  <Typography variant="body1" fontWeight="bold">
                    {(Number(priceOffer.totalTTC ?? 0)).toFixed(2)}
                  </Typography>
                </td>
           </tr>
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
                <Typography style={{ marginBottom: '.5rem' }}  variant="body2">N/A</Typography>
                <Typography style={{ marginBottom: '.5rem' }} variant="body2">+/- 1 jour</Typography>
                <Typography style={{ marginBottom: '.5rem' }} variant="body2">N/A</Typography>
                <Typography style={{ marginBottom: '.5rem' }} variant="body2">100% à la commande</Typography>
              </Box>
            </Box>
          </Box>
          <Typography style={{fontWeight: 'bold', marginBottom: '2rem',fontSize: '.8rem'}} variant="subtitle2" gutterBottom>NB: Après prise de RDV, le client doit faciliter l'acces au bureau/pièce concerné. Si l'intervnetion ne peut se faire faute de disponibilité, un déplacment pourra être facturé</Typography>
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
      </Container>
    </Layout>
  );
};

export default PriceOfferPage;