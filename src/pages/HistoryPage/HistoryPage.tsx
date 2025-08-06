import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Button,
  Paper,
  Card,
  IconButton,
  Divider,
  FormControlLabel,
  Switch
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import Layout from '../../components/Layout/Layout';
import './HistoryPage.scss';
import { ReceiptLongOutlined } from '@mui/icons-material';
import logo from '../../logo.png';
import AddAlarmIcon from '@mui/icons-material/AddAlarm';
import WarningIcon from '@mui/icons-material/Warning';
import { Client, Site, Quote } from '../../models/Quote';
import { apiService } from '../../services/api-service';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CustomNumberInput from '../../components/CustomNumberInput/CustomNumberInput';

interface HistoryPageProps {
  currentPath: string;
  onNavigate: (path: string, quoteId?: string) => void;
}

const HistoryPage: React.FC<HistoryPageProps> = ({ currentPath, onNavigate }) => {
  // Filter state
  const [filters, setFilters] = useState({
    id: '',
    client: '',
    site: '',
    period: 'all',
    startDate: '',
    endDate: '',
    showAlertedOnly: false,
  });
  const [clients, setClients] = useState<Client[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [filteredQuotes, setFilteredQuotes] = useState<Quote[]>([]);

  // Group quotes by parentId (originals by their own id, updates by parentId)
  const groupedQuotes = React.useMemo(() => {
    const groups: { [groupId: string]: Quote[] } = {};
    for (const quote of filteredQuotes) {
      // Treat parentId of '', undefined, or '0' as no parent (original)
      const hasValidParent = quote.parentId && quote.parentId !== '' && quote.parentId !== '0';
      let groupId = hasValidParent ? quote.parentId : quote.id;
      if (!groupId) groupId = quote.id; // Ensure groupId is always a string
      if (!groups[groupId]) groups[groupId] = [];
      groups[groupId].push(quote);
    }
    // Sort each group by createdAt (oldest first)
    Object.values(groups).forEach(group => {
      group.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    });
    return groups;
  }, [filteredQuotes]);

  // Local state for reminder days per quote
  const [reminderDays, setReminderDays] = useState<{ [quoteId: string]: number }>({});

  // Fetch clients, sites, and quotes on mount
  useEffect(() => {
    const fetchData = async () => {
      const [allClients, allQuotes] = await Promise.all([
        apiService.getClients ? apiService.getClients() : [],
        apiService.getQuotes(),
      ]);
      // Fetch sites for each client and attach
      const clientsWithSites = await Promise.all(
        (allClients || []).map(async (client) => {
          const sites = await apiService.getSitesByClientId(client.id);
          return { ...client, sites: sites || [] };
        })
      );
      setClients(clientsWithSites);
      setQuotes(allQuotes || []);

      // Check for passed reminder dates
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const passedReminders = (allQuotes || []).filter(quote => {
        if (!quote.reminderDate) return false;
        const reminderDate = new Date(quote.reminderDate);
        reminderDate.setHours(0, 0, 0, 0);
        return reminderDate < today;
      });

      if (passedReminders.length > 0) {
        const quoteIds = passedReminders.map(q => q.id).join(', ');
        alert(`Attention: Les rappels pour les devis suivants sont passés: ${quoteIds}`);
      }
    };
    fetchData();
  }, []);

  // Update sites when client changes
  useEffect(() => {
    if (filters.client) {
      const client = clients.find(c => c.id === filters.client);
      setSites(client ? client.sites : []);
      // If the selected site does not belong to the new client, reset it
      if (filters.site && !(client && client.sites.some(s => s.id === filters.site))) {
        setFilters(prev => ({ ...prev, site: '' }));
      }
    } else {
      setSites([]);
      setFilters(prev => ({ ...prev, site: '' }));
    }
    // eslint-disable-next-line
  }, [filters.client, clients]);

  // Helper to parse date safely
  const parseQuoteDate = (dateStr: string | Date): Date => {
    if (dateStr instanceof Date) return dateStr;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return new Date(dateStr + 'T00:00:00');
    }
    return new Date(dateStr);
  };

  // Helper to check if quote has passed reminder date and is not confirmed
  const hasPassedReminderDate = (quote: Quote): boolean => {
    if (!quote.reminderDate || quote.confirmed) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const reminderDate = new Date(quote.reminderDate);
    reminderDate.setHours(0, 0, 0, 0);
    return reminderDate < today;
  };

  // Apply filters to quotes
  useEffect(() => {
    let result = [...quotes];
    if (filters.id) {
      result = result.filter(q => q.id.includes(filters.id));
    }
    if (filters.client) {
      result = result.filter(q => q.clientName === (clients.find(c => c.id === filters.client)?.name));
    }
    if (filters.site) {
      result = result.filter(q => q.siteName === (sites.find(s => s.id === filters.site)?.name));
    }
    // Filter for alerted quotes (passed reminder date and not confirmed)
    if (filters.showAlertedOnly) {
      result = result.filter(q => hasPassedReminderDate(q));
    }
    // Date filtering logic for period
    if (filters.period !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (filters.period === 'today') {
        result = result.filter(q => {
          const quoteDate = parseQuoteDate(q.date);
          quoteDate.setHours(0, 0, 0, 0);
          return quoteDate.getTime() === today.getTime();
        });
      } else if (filters.period === 'week') {
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        result = result.filter(q => {
          const quoteDate = parseQuoteDate(q.date);
          return quoteDate >= startOfWeek && quoteDate <= today;
        });
      } else if (filters.period === 'month') {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        result = result.filter(q => {
          const quoteDate = parseQuoteDate(q.date);
          return quoteDate >= startOfMonth && quoteDate <= today;
        });
      } else if (filters.period === 'year') {
        const startOfYear = new Date(today.getFullYear(), 0, 1);
        result = result.filter(q => {
          const quoteDate = parseQuoteDate(q.date);
          return quoteDate >= startOfYear && quoteDate <= today;
        });
      } else if (filters.period === 'custom' && filters.startDate && filters.endDate) {
        const startDate = parseQuoteDate(filters.startDate);
        const endDate = parseQuoteDate(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        result = result.filter(q => {
          const quoteDate = parseQuoteDate(q.date);
          return quoteDate >= startDate && quoteDate <= endDate;
        });
      }
    }
    setFilteredQuotes(result);
    // eslint-disable-next-line
  }, [filters, quotes, clients, sites]);

  // Handlers
  const handleFilterChange = (field: string, value: string | boolean) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };
  const handleClearFilters = () => {
    setFilters({ id: '', client: '', site: '', period: 'all', startDate: '', endDate: '', showAlertedOnly: false });
  };

  // Handlers for quote card actions
  const handleLoadQuote = (quoteId: string) => {
    const quote = quotes.find(q => q.id === quoteId);
    if (quote) {
      if (quote.reminderDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const reminder = new Date(quote.reminderDate);
        reminder.setHours(0, 0, 0, 0);
        if (reminder < today) {
          alert("Attention : la date de rappel de ce devis est dépassée !");
        }
      }
      if (quote.confirmed) {
        onNavigate(`/quote?id=${quoteId}`);
      } else {
        onNavigate(`/quote?id=${quoteId}&showConfirm=true`);
      }
    }
  };
  const handleDeleteQuote = async (quoteId: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce devis ?')) {
      // Call backend to delete by id only
      await apiService.deleteQuote(quoteId);
      setQuotes(prev => prev.filter(q => q.id !== quoteId));
    }
  };
  const handleViewPriceOffer = (quoteId: string) => {
    onNavigate('/price-offer', quoteId);
  };
  const handleReminderChange = (quoteId: string, value: number) => {
    setReminderDays(prev => ({ ...prev, [quoteId]: value }));
  };
  const handleSetReminder = async (quoteId: string) => {
    const days = reminderDays[quoteId] || 0;
    if (days < 1) return;
    const currentDate = new Date();
    const reminderDate = new Date(currentDate.setDate(currentDate.getDate() + days));
    const formattedDate = reminderDate.toISOString().split('T')[0];
    // Use fetch directly since fetchApi is private
    await fetch(`http://localhost:5000/api/quotes/${quoteId}/reminder`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reminderDate: formattedDate }),
    });
    setQuotes(prev => prev.map(q => q.id === quoteId ? { ...q, reminderDate: formattedDate } : q));
    alert('Rappel configuré avec succès');
  };

  return (
    <Layout currentPath={currentPath} onNavigate={onNavigate}>
      <Container maxWidth="lg" className="history-page">
        <Box sx={{ display: 'flex', position: 'relative', width: '100%', height: '80px', backgroundColor: 'white', color: 'black' }} className="page-header">
          <Box sx={{ position: 'absolute', left: 0, display: 'flex', alignItems: 'center', gap: 40 }}>
          <img
            src={logo}
            alt="Logo"
            style={{ height: '60px' }}
          />
          <Typography variant="h6" className="header-title">
            HISTORIQUE
          </Typography>
        </Box>
         </Box>
        <Paper elevation={3} className="filters-section">
          <Typography variant="h6" gutterBottom>
            Filtres
          </Typography>

          <Box className="filters-grid">
            <TextField
              fullWidth
              label="ID"
              variant="outlined"
              size="small"
              value={filters.id}
              onChange={e => handleFilterChange('id', e.target.value)}
            />

            <FormControl fullWidth size="small">
              <InputLabel>Client</InputLabel>
              <Select
                label="Client"
                value={filters.client}
                onChange={e => handleFilterChange('client', e.target.value as string)}
              >
                <MenuItem value="">Tous les clients</MenuItem>
                {(clients || []).map(client => (
                  <MenuItem key={client.id} value={client.id}>{client.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel>Site</InputLabel>
              <Select
                label="Site"
                value={filters.site}
                onChange={e => handleFilterChange('site', e.target.value as string)}
                disabled={!filters.client}
              >
                <MenuItem value="">Tous les sites</MenuItem>
                {(sites || []).map(site => (
                  <MenuItem key={site.id} value={site.id}>{site.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel>Période</InputLabel>
              <Select
                label="Période"
                value={filters.period}
                onChange={e => handleFilterChange('period', e.target.value as string)}
              >
                <MenuItem value="all">Toutes les dates</MenuItem>
                <MenuItem value="today">Aujourd'hui</MenuItem>
                <MenuItem value="week">Cette semaine</MenuItem>
                <MenuItem value="month">Ce mois</MenuItem>
                <MenuItem value="year">Cette année</MenuItem>
                <MenuItem value="custom">Période personnalisée</MenuItem>
              </Select>
            </FormControl>

            {/* Show date pickers if custom period is selected */}
            {filters.period === 'custom' && (
              <>
                <TextField
                  label="Date de début"
                  type="date"
                  size="small"
                  value={filters.startDate}
                  onChange={e => handleFilterChange('startDate', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ minWidth: 180, marginRight: 2, marginTop: 1 }}
                />
                <TextField
                  label="Date de fin"
                  type="date"
                  size="small"
                  value={filters.endDate}
                  onChange={e => handleFilterChange('endDate', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ minWidth: 180, marginTop: 1 }}
                />
              </>
            )}
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={filters.showAlertedOnly}
                  onChange={(e) => handleFilterChange('showAlertedOnly', e.target.checked)}
                  color="warning"
                />
              }
              label="Afficher uniquement les devis avec rappel dépassé"
            />
            <Button variant="outlined" size="small" onClick={handleClearFilters}>
              Effacer les filtres
            </Button>
          </Box>
        </Paper>

        <Box sx={{ mt: 3 }}>
          {/* Render grouped quotes by base ID */}
          {Object.entries(groupedQuotes).map(([baseId, versions]) => (
            <Box key={baseId} sx={{ mb: 4, border: '2px solid #1976d2', borderRadius: 2, p: 2 }}>
              <Typography variant="h6" color="primary" sx={{ mb: 2 }}>
                Groupe de devis: {baseId}
              </Typography>
              {versions.map((quote, idx) => {
                const isOriginal = idx === 0;
                const isLatest = idx === versions.length - 1;
                return (
                  <Card className="quote-card" key={quote.id} sx={{ mb: 2, background: isLatest ? '#e3f2fd' : undefined }}>
                    <Box className="card-header">
                      <Box className="quote-id">
                        <Typography component="span" className="id-number">
                          {quote.id}
                        </Typography>
                        {/* Check icon for confirmed status */}
                        {quote.confirmed ? (
                          <CheckCircleIcon sx={{ color: '#4caf50', ml: 1 }} titleAccess="Confirmé" />
                        ) : (
                          <CheckCircleOutlineIcon sx={{ color: '#bdbdbd', ml: 1 }} titleAccess="Non confirmé" />
                        )}
                        {/* Alert icon for passed reminder date */}
                        {hasPassedReminderDate(quote) && (
                          <WarningIcon sx={{ color: '#ff9800', ml: 1 }} titleAccess="Rappel dépassé" />
                        )}
                        <Typography component="span" className={`version-label ${isOriginal ? 'original' : 'update'}`}
                          sx={{ ml: 1 }}>
                          {isOriginal ? 'Version originale' : `Version ${idx}`}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(quote.createdAt).toLocaleDateString('fr-FR')}
                      </Typography>
                    </Box>
                    <Divider />
                    <Box className="card-content">
                      <Box className="info-grid">
                        <Box className="info-item">
                          <Typography className="label">Client</Typography>
                          <Typography className="value">{quote.clientName || 'Non spécifié'}</Typography>
                        </Box>
                        <Box className="info-item">
                          <Typography className="label">Site</Typography>
                          <Typography className="value">{quote.siteName || 'Non spécifié'}</Typography>
                        </Box>
                        <Box className="info-item">
                          <Typography className="label">Date</Typography>
                          <Typography className="value">{new Date(quote.date).toLocaleDateString('fr-FR')}</Typography>
                        </Box>
                        <Box className="info-item">
                          <Typography className="label">Total TTC</Typography>
                          <Typography className="value total">
                            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD' }).format(quote.totalTTC)}
                            {quote.remise && quote.remise > 0 && (
                              <Typography
                                component="span"
                                sx={{
                                  ml: 1,
                                  color: '#4caf50',
                                  fontSize: '0.85em',
                                  fontWeight: 'bold'
                                }}
                              >
                                (-{quote.remise}%)
                              </Typography>
                            )}
                          </Typography>
                        </Box>
                      </Box>
                      {isLatest && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2, borderTop: '1px solid rgba(0, 0, 0, 0.12)', paddingTop: 2 }}>
                          <CustomNumberInput
                            label="Jours de rappel"
                            value={reminderDays[quote.id] || 0}
                            onChange={value => handleReminderChange(quote.id, value)}
                            min={0}
                            fullWidth={false}
                          />
                          <IconButton color="primary" sx={{ ml: 1 }} onClick={() => handleSetReminder(quote.id)}>
                            <AddAlarmIcon />
                          </IconButton>
                        </Box>
                      )}
                    </Box>
                    <Box className="card-actions">
                      <Button className="action-button view" size="small" startIcon={<VisibilityIcon />} onClick={() => handleLoadQuote(quote.id)}>
                        Voir
                      </Button>
                      {isLatest && (
                        <>
                          <Button className="action-button" size="small" color="primary" startIcon={<ReceiptLongOutlined />} onClick={() => handleViewPriceOffer(quote.id)}>
                            Voir l'offre de prix
                          </Button>
                          <Button className="action-button delete" size="small" color="error" startIcon={<DeleteIcon />} onClick={() => handleDeleteQuote(quote.id)}>
                            Supprimer
                          </Button>
                        </>
                      )}
                    </Box>
                  </Card>
                );
              })}
            </Box>
          ))}
        </Box>
      </Container>
    </Layout>
  );
};

export default HistoryPage;