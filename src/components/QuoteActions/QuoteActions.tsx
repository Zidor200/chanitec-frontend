import React from 'react';
import { Box, Button, Paper, Snackbar, Alert } from '@mui/material';
import {
  SaveOutlined,
  PrintOutlined,
  GetApp as DownloadIcon,
  Update as UpdateIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { usePDF } from 'react-to-pdf';
import './QuoteActions.scss';

interface QuoteActionsProps {
  clientName: string;
  siteName: string;
  date: string;
  isExistingQuote: boolean;
  onSave: () => Promise<boolean>;
  onUpdate?: () => Promise<boolean>;
  onViewHistory: () => void;
  contentRef: React.RefObject<HTMLDivElement>;
}

const QuoteActions: React.FC<QuoteActionsProps> = ({
  clientName,
  siteName,
  date,
  isExistingQuote,
  onSave,
  onUpdate,
  onViewHistory,
  contentRef
}) => {
  const [snackbarOpen, setSnackbarOpen] = React.useState(false);
  const [snackbarMessage, setSnackbarMessage] = React.useState('');
  const [snackbarSeverity, setSnackbarSeverity] = React.useState<'success' | 'error'>('success');

  // Setup PDF generation
  const { toPDF, targetRef } = usePDF({
    filename: generatePdfFilename(),
    page: {
      format: 'A4',
      margin: 0
    },
    method: 'open',
    canvas: {
      mimeType: 'image/png',
      qualityRatio: 1
    }
  });

  // Handle save action
  const handleSave = async () => {
    try {
      const success = await onSave();

      if (success) {
        setSnackbarMessage('Devis enregistré avec succès!');
        setSnackbarSeverity('success');
      } else {
        setSnackbarMessage('Erreur lors de l\'enregistrement du devis.');
        setSnackbarSeverity('error');
      }

      setSnackbarOpen(true);
    } catch (error) {
      setSnackbarMessage('Erreur lors de l\'enregistrement du devis.');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  // Handle update action
  const handleUpdate = async () => {
    if (!onUpdate) return;

    try {
      console.log('Starting quote update process...');
      console.log('Current quote data before update:', {
        clientName,
        siteName,
        date,
        isExistingQuote
      });

      const success = await onUpdate();
      console.log('Update result:', success);

      if (success) {
        setSnackbarMessage('Nouvelle version du devis créée avec succès!');
        setSnackbarSeverity('success');
      } else {
        setSnackbarMessage('Erreur lors de la création d\'une nouvelle version.');
        setSnackbarSeverity('error');
      }

      setSnackbarOpen(true);
    } catch (error) {
      console.error('Error in handleUpdate:', error);
      setSnackbarMessage('Erreur lors de la création d\'une nouvelle version.');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  // Generate PDF filename
  function generatePdfFilename() {
    const formattedDate = date ? format(new Date(date), 'dd-MM-yyyy') : format(new Date(), 'dd-MM-yyyy');
    const cleanClientName = (clientName || 'Client').replace(/[^a-zA-Z0-9]/g, '-');
    const cleanSiteName = (siteName || 'Site').replace(/[^a-zA-Z0-9]/g, '-');

    return `${cleanClientName}-${cleanSiteName}-${formattedDate}.pdf`;
  };

  // Handle PDF download
  const handleDownloadPDF = () => {
    if (contentRef.current) {
      // Add pdf-print-mode class to apply print styling
      contentRef.current.classList.add('pdf-print-mode');

      // Force a reflow to ensure styles are applied
      const reflow = contentRef.current.offsetHeight;
      void reflow;

      // Use the ref from props instead of the one from usePDF
      targetRef.current = contentRef.current;

      // Generate PDF after a small delay to ensure styles are applied
      setTimeout(() => {
        toPDF();

        // Remove the class after PDF generation
        setTimeout(() => {
          contentRef.current?.classList.remove('pdf-print-mode');
        }, 1000);
      }, 100);

      setSnackbarMessage('PDF téléchargé avec succès!');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    }
  };

  // Handle print action using browser print functionality
  const handlePrint = () => {
    if (contentRef.current) {
      // Instead of opening a new window, trigger the browser's native print dialog
      // This way, all print media queries will be applied
      window.print();
    }
  };

  // Close snackbar
  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

  return (
    <Paper className="quote-actions" elevation={2}>
      <Box className="actions-container">
        {isExistingQuote ? (
          <Button
            variant="contained"
            color="primary"
            className="action-button update-button"
            startIcon={<UpdateIcon />}
            onClick={handleSave}
          >
            Mettre à jour
          </Button>
        ) : (
          <Button
            variant="contained"
            color="primary"
            className="action-button save-button"
            startIcon={<SaveOutlined />}
            onClick={handleSave}
          >
            Enregistrer
          </Button>
        )}

        <Button
          variant="contained"
          color="secondary"
          className="action-button print-button"
          startIcon={<PrintOutlined />}
          onClick={handlePrint}
        >
          Imprimer
        </Button>

        <Button
          variant="contained"
          color="info"
          className="action-button download-button"
          startIcon={<DownloadIcon />}
          onClick={handleDownloadPDF}
        >
          Télécharger PDF
        </Button>
      </Box>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbarSeverity}
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Paper>
  );
};

export default QuoteActions;