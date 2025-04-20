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
  CardContent,
  CardActions,
  IconButton,
  Divider
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ClearIcon from '@mui/icons-material/Clear';
import InfoIcon from '@mui/icons-material/Info';
import Layout from '../../components/Layout/Layout';
import { useQuote } from '../../contexts/QuoteContext';
import { apiService } from '../../services/api-service';
import { Quote, Client, Site } from '../../models/Quote';
import { extractBaseId, extractVersion } from '../../utils/id-generator';
import './HistoryPage.scss';
import { ReceiptLongOutlined } from '@mui/icons-material';
import { priceOfferService } from '../../services/price-offer-service';

interface HistoryPageProps {
  currentPath: string;
  onNavigate: (path: string, quoteId?: string) => void;
}

const HistoryPage: React.FC<HistoryPageProps> = ({ currentPath, onNavigate }) => {
  // States for quotes and filters
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [filteredQuotes, setFilteredQuotes] = useState<Quote[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [quoteVersions, setQuoteVersions] = useState<{ [baseId: string]: Quote[] }>({});
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [showAllVersions, setShowAllVersions] = useState<boolean>(false);

  // Filter states
  const [filters, setFilters] = useState({
    id: '',
    client: '',
    site: '',
    period: 'all',
  });

  const { loadQuote } = useQuote();

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, []);

  // Update filtered quotes when filters or quotes change
  useEffect(() => {
    applyFilters();
  }, [filters, quotes, showAllVersions]);

  // Load all necessary data from API
  const loadData = async () => {
    try {
      console.log('Loading quotes and clients...');
      const [allQuotes, allClients] = await Promise.all([
        apiService.getQuotes(),
        apiService.getClients()
      ]);

      console.log(`Loaded ${allQuotes.length} quotes and ${allClients.length} clients`);

      // Group quotes by base ID to identify versions
      const versionGroups: { [baseId: string]: Quote[] } = {};

      allQuotes.forEach(quote => {
        const baseId = extractBaseId(quote.id);
        if (baseId) {
          if (!versionGroups[baseId]) {
            versionGroups[baseId] = [];
          }
          versionGroups[baseId].push(quote);
        }
      });

      console.log(`Found ${Object.keys(versionGroups).length} quote groups`);

      // Sort each group by version
      Object.keys(versionGroups).forEach(baseId => {
        versionGroups[baseId].sort((a, b) => {
          const versionA = extractVersion(a.id) ?? 0;
          const versionB = extractVersion(b.id) ?? 0;
          return versionB - versionA; // newest first
        });
      });

      setQuoteVersions(versionGroups);
      setQuotes(allQuotes);
      setClients(allClients);
      setFilteredQuotes(allQuotes);
    } catch (error) {
      console.error('Error loading data:', error);
      // You might want to show an error message to the user here
    }
  };

  // Update site options when client changes
  const updateSiteOptions = async () => {
    if (filters.client) {
      try {
        const sitesForClient = await apiService.getSitesByClientId(filters.client);
        setSites(sitesForClient);
      } catch (error) {
        console.error('Error loading sites:', error);
        alert('Erreur lors du chargement des sites');
      }
    } else {
      setSites([]);
    }

    // Reset site filter when client changes
    setFilters(prev => ({ ...prev, site: '' }));
  };

  // Apply all filters to the quotes
  const applyFilters = () => {
    let result = [...quotes];

    // Filter by ID - either exact ID match or baseId match
    if (filters.id) {
      // Check if the filter is a base ID (8 digits) or a full quote ID
      const isBaseIdFilter = /^\d{8}$/.test(filters.id);

      if (isBaseIdFilter) {
        // Filter by base ID - show all quotes with this base ID
        result = result.filter(quote => {
          const baseId = extractBaseId(quote.id);
          return baseId === filters.id;
        });
      } else {
        // Regular ID filter - use contains for flexibility
        result = result.filter(quote =>
          quote.id.toLowerCase().includes(filters.id.toLowerCase())
        );
      }
    }

    // Filter by client
    if (filters.client) {
      result = result.filter(quote =>
        quote.clientName === clients.find(c => c.id === filters.client)?.name
      );
    }

    // Filter by site
    if (filters.site) {
      result = result.filter(quote =>
        quote.siteName === sites.find(s => s.id === filters.site)?.name
      );
    }

    // Filter by date
    if (filters.period !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      switch (filters.period) {
        case 'today':
          result = result.filter(quote => {
            const quoteDate = new Date(quote.date);
            quoteDate.setHours(0, 0, 0, 0);
            return quoteDate.getTime() === today.getTime();
          });
          break;

        case 'week':
          const startOfWeek = new Date(today);
          startOfWeek.setDate(today.getDate() - today.getDay());
          result = result.filter(quote => {
            const quoteDate = new Date(quote.date);
            return quoteDate >= startOfWeek && quoteDate <= today;
          });
          break;

        case 'month':
          const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
          result = result.filter(quote => {
            const quoteDate = new Date(quote.date);
            return quoteDate >= startOfMonth && quoteDate <= today;
          });
          break;

        case 'year':
          const startOfYear = new Date(today.getFullYear(), 0, 1);
          result = result.filter(quote => {
            const quoteDate = new Date(quote.date);
            return quoteDate >= startOfYear && quoteDate <= today;
          });
          break;
      }
    }

    // Sort by date (newest first)
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // If not showing all versions and not filtering by base ID, filter to show only the latest version of each quote
    if (!showAllVersions && !(/^\d{8}$/.test(filters.id))) {
      // Group by base ID
      const groupedByBaseId: { [baseId: string]: Quote[] } = {};
      result.forEach(quote => {
        const baseId = extractBaseId(quote.id);
        if (baseId) {
          if (!groupedByBaseId[baseId]) {
            groupedByBaseId[baseId] = [];
          }
          groupedByBaseId[baseId].push(quote);
        } else {
          // For quotes that don't match the new format, treat them as individual quotes
          groupedByBaseId[quote.id] = [quote];
        }
      });

      // For each group, only include the latest version and any versions that are explicitly expanded
      const filteredResult: Quote[] = [];
      Object.entries(groupedByBaseId).forEach(([baseId, quotes]) => {
        // Sort by version, newest first
        quotes.sort((a, b) => {
          const versionA = extractVersion(a.id) ?? 0;
          const versionB = extractVersion(b.id) ?? 0;
          return versionB - versionA;
        });

        if (expandedGroups.includes(baseId)) {
          // If this group is expanded, add all versions
          filteredResult.push(...quotes);
        } else {
          // Otherwise, only add the latest version
          if (quotes.length > 0) {
            filteredResult.push(quotes[0]);
          }
        }
      });

      // Re-sort the filtered results
      filteredResult.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      result = filteredResult;
    }

    setFilteredQuotes(result);
  };

  // Toggle the expanded state of a quote group
  const toggleGroupExpand = (baseId: string) => {
    if (expandedGroups.includes(baseId)) {
      setExpandedGroups(expandedGroups.filter(id => id !== baseId));
    } else {
      setExpandedGroups([...expandedGroups, baseId]);
    }
  };

  // Toggle showing all versions
  const toggleShowAllVersions = () => {
    setShowAllVersions(!showAllVersions);
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      id: '',
      client: '',
      site: '',
      period: 'all',
    });
    setShowAllVersions(false);
  };

  // Load a quote
  const handleLoadQuote = async (quoteId: string) => {
    try {
      // First load the quote data
      await loadQuote(quoteId);
      // Then navigate to the home page where the quote will be displayed
      onNavigate('/');
    } catch (error) {
      console.error('Error loading quote:', error);
      alert('Erreur lors du chargement du devis');
    }
  };

  // Delete a quote
  const handleDeleteQuote = async (quoteId: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce devis?')) {
      try {
        await apiService.deleteQuote(quoteId);
        const updatedQuotes = quotes.filter(quote => quote.id !== quoteId);
        setQuotes(updatedQuotes);

        // Also remove from version groups if needed
        const baseId = extractBaseId(quoteId);
        if (baseId && quoteVersions[baseId]) {
          const updatedVersions = quoteVersions[baseId].filter(q => q.id !== quoteId);
          if (updatedVersions.length === 0) {
            const { [baseId]: _, ...remainingGroups } = quoteVersions;
            setQuoteVersions(remainingGroups);
          } else {
            setQuoteVersions({
              ...quoteVersions,
              [baseId]: updatedVersions
            });
          }
        }
      } catch (error) {
        console.error('Error deleting quote:', error);
        alert('Erreur lors de la suppression du devis');
      }
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Format quote ID for display, highlighting the version
  const formatQuoteId = (id: string) => {
    const version = extractVersion(id);
    if (version !== null) {
      return (
        <span>
          {id.substring(0, id.length - 3)}
          <span className={`version-highlight ${version === 0 ? 'original' : 'update'}`}>
            {id.substring(id.length - 3)}
          </span>
        </span>
      );
    }
    return id;
  };

  // Get version label
  const getVersionLabel = (quoteId: string) => {
    const version = extractVersion(quoteId);
    if (version === null) return null;

    if (version === 0) {
      return (
        <Typography
          variant="caption"
          className="version-badge original"
        >
          Version originale
        </Typography>
      );
    } else {
      return (
        <Typography
          variant="caption"
          className="version-badge update"
        >
          Version {version}
        </Typography>
      );
    }
  };

  // Check if a quote has other versions
  const hasOtherVersions = (quoteId: string) => {
    const baseId = extractBaseId(quoteId);
    return baseId && quoteVersions[baseId] && quoteVersions[baseId].length > 1;
  };

  // Get the total number of versions for a quote
  const getVersionCount = (quoteId: string) => {
    const baseId = extractBaseId(quoteId);
    return baseId && quoteVersions[baseId] ? quoteVersions[baseId].length : 1;
  };

  // Show all versions of a specific quote
  const showRelatedVersions = (quoteId: string) => {
    const baseId = extractBaseId(quoteId);
    if (!baseId) return;

    // Clear other filters
    setFilters(prev => ({
      ...prev,
      id: '',
      client: '',
      site: '',
      period: 'all',
    }));

    // Show all versions
    setShowAllVersions(true);

    // Set the filter to only show quotes with this base ID
    setFilters(prev => ({ ...prev, id: baseId }));
  };

  const handleViewPriceOffer = (quote: Quote) => {
    // Create price offer if it doesn't exist
    if (!priceOfferService.getByQuoteId(quote.id)) {
      priceOfferService.createFromQuote(quote);
    }
    onNavigate('/price-offer', quote.id);
  };

  return (
    <Layout currentPath={currentPath} onNavigate={onNavigate}>
      <Container maxWidth="lg" className="history-page">
        <Box className="page-header">
          <Typography variant="h6" className="header-title">
            HISTORIQUE
          </Typography>
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
              value={filters.id}
              onChange={(e) => setFilters(prev => ({ ...prev, id: e.target.value }))}
              size="small"
            />

            <FormControl fullWidth size="small">
              <InputLabel>Client</InputLabel>
              <Select
                value={filters.client}
                label="Client"
                onChange={(e) => {
                  setFilters(prev => ({ ...prev, client: e.target.value as string }));
                  updateSiteOptions();
                }}
              >
                <MenuItem value="">Tous les clients</MenuItem>
                {clients.map(client => (
                  <MenuItem key={client.id} value={client.id}>
                    {client.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel>Site</InputLabel>
              <Select
                value={filters.site}
                label="Site"
                onChange={(e) => setFilters(prev => ({ ...prev, site: e.target.value as string }))}
                disabled={!filters.client}
              >
                <MenuItem value="">Tous les sites</MenuItem>
                {sites.map(site => (
                  <MenuItem key={site.id} value={site.id}>
                    {site.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel>Période</InputLabel>
              <Select
                value={filters.period}
                label="Période"
                onChange={(e) => setFilters(prev => ({ ...prev, period: e.target.value as string }))}
              >
                <MenuItem value="all">Toutes les dates</MenuItem>
                <MenuItem value="today">Aujourd'hui</MenuItem>
                <MenuItem value="week">Cette semaine</MenuItem>
                <MenuItem value="month">Ce mois</MenuItem>
                <MenuItem value="year">Cette année</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={toggleShowAllVersions}
            >
              {showAllVersions ? 'Masquer les versions' : 'Afficher toutes les versions'}
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={clearFilters}
            >
              Effacer les filtres
            </Button>
          </Box>
        </Paper>

        <Box sx={{ mt: 3 }}>
          {filteredQuotes.length === 0 ? (
            <Typography variant="body1">Aucun devis trouvé</Typography>
          ) : /^\d{8}$/.test(filters.id) ? (
            // When filtering by base ID, display quotes grouped by that base ID
            <>
              <Box className="versions-group-header">
                <InfoIcon sx={{ mr: 1, color: '#1976d2' }} />
                <Typography variant="subtitle1">
                  Versions du devis avec base ID: <span className="group-id">{filters.id}</span>
                </Typography>
                <Box className="group-actions">
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setFilters(prev => ({ ...prev, id: '' }))}
                  >
                    Retour à tous les devis
                  </Button>
                </Box>
              </Box>

              {filteredQuotes.map((quote, index, array) => {
                const version = extractVersion(quote.id) ?? 0;
                const baseId = extractBaseId(quote.id);
                const isLatestVersion = baseId && quoteVersions[baseId] &&
                  quoteVersions[baseId][0].id === quote.id;
                const versionCount = baseId ? getVersionCount(quote.id) : 1;
                const isExpanded = baseId ? expandedGroups.includes(baseId) : false;
                const isHighlighted = /^\d{8}$/.test(filters.id) && baseId === filters.id;

                return (
                  <Card
                    key={quote.id}
                    className={`quote-card highlighted-group ${version === 0 ? 'version-original' : 'version-update'}`}
                    sx={{
                      mb: index === array.length - 1 ? 2 : 0
                    }}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Typography variant="h6" component="div">
                            {formatQuoteId(quote.id)}
                          </Typography>
                          {getVersionLabel(quote.id)}
                          <Box className="version-actions">
                            {/* We don't need any buttons here since this is the filtered view */}
                          </Box>
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          {formatDate(quote.createdAt)}
                        </Typography>
                      </Box>

                      <Divider sx={{ mb: 2 }} />

                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 1 }}>
                        <Box sx={{ flex: '1 1 200px' }}>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            Client
                          </Typography>
                          <Typography variant="body1">
                            {quote.clientName || "Non spécifié"}
                          </Typography>
                        </Box>

                        <Box sx={{ flex: '1 1 200px' }}>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            Site
                          </Typography>
                          <Typography variant="body1">
                            {quote.siteName || "Non spécifié"}
                          </Typography>
                        </Box>

                        <Box sx={{ flex: '1 1 200px' }}>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            Date
                          </Typography>
                          <Typography variant="body1">
                            {formatDate(quote.date)}
                          </Typography>
                        </Box>

                        <Box sx={{ flex: '1 1 200px' }}>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            Total TTC
                          </Typography>
                          <Typography variant="body1" fontWeight="bold">
                            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD' }).format(quote.totalTTC)}
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>

                    <CardActions disableSpacing>
                      <Button
                        size="small"
                        startIcon={<VisibilityIcon />}
                        onClick={() => handleLoadQuote(quote.id)}
                      >
                        Consulter
                      </Button>

                      <Button
                        size="small"
                        startIcon={<ReceiptLongOutlined />}
                        onClick={() => handleViewPriceOffer(quote)}
                        color="primary"
                      >
                        Voir l'offre de prix
                      </Button>

                      <Box sx={{ flexGrow: 1 }} />

                      <IconButton
                        aria-label="supprimer"
                        onClick={() => handleDeleteQuote(quote.id)}
                        size="small"
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </CardActions>
                  </Card>
                );
              })}
            </>
          ) : (
            // Regular rendering of quotes when not filtering by base ID
            filteredQuotes.map((quote) => {
              const baseId = extractBaseId(quote.id);
              const version = extractVersion(quote.id) ?? 0;
              const isLatestVersion = baseId && quoteVersions[baseId] &&
                quoteVersions[baseId][0].id === quote.id;
              const isExpanded = baseId ? expandedGroups.includes(baseId) : false;

              return (
                <Card key={quote.id} className="quote-card">
                  <Box className="card-header">
                    <Box className="quote-id">
                      <Typography component="span" className="id-number">
                        F-{quote.id}
                      </Typography>
                      {quote.id.endsWith('001') ? (
                        <Typography component="span" className="version-label original">
                          Version 1
                        </Typography>
                      ) : (
                        <Typography component="span" className="version-label update">
                          Version {parseInt(quote.id.slice(-3))}
                        </Typography>
                      )}
                      {hasOtherVersions(quote.id) && (
                        <Button
                          size="small"
                          color="primary"
                          onClick={() => baseId && showRelatedVersions(quote.id)}
                        >
                          Voir toutes les versions ({getVersionCount(quote.id)})
                        </Button>
                      )}
                      {hasOtherVersions(quote.id) && isLatestVersion && (
                        <Button
                          size="small"
                          color="secondary"
                          onClick={() => baseId && toggleGroupExpand(baseId)}
                        >
                          {isExpanded ? 'Replier' : 'Déplier'}
                        </Button>
                      )}
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(quote.createdAt)}
                    </Typography>
                  </Box>

                  <Divider />

                  <Box className="card-content">
                    <Box className="info-grid">
                      <Box className="info-item">
                        <Typography className="label">Client</Typography>
                        <Typography className="value">{quote.clientName || "Non spécifié"}</Typography>
                      </Box>

                      <Box className="info-item">
                        <Typography className="label">Site</Typography>
                        <Typography className="value">{quote.siteName || "Non spécifié"}</Typography>
                      </Box>

                      <Box className="info-item">
                        <Typography className="label">Date</Typography>
                        <Typography className="value">{formatDate(quote.date)}</Typography>
                      </Box>

                      <Box className="info-item">
                        <Typography className="label">Total TTC</Typography>
                        <Typography className="value total">
                          {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD' }).format(quote.totalTTC)}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>

                  <Box className="card-actions">
                    <IconButton
                      className="action-button view"
                      onClick={() => handleLoadQuote(quote.id)}
                      size="small"
                    >
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      className="action-button delete"
                      onClick={() => handleDeleteQuote(quote.id)}
                      size="small"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Card>
              );
            })
          )}
        </Box>
      </Container>
    </Layout>
  );
};

export default HistoryPage;