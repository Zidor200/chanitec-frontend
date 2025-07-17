import React, { useState, useEffect } from 'react';

import logo from '../../logo.png';
import {
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Card,
  CardContent,
  InputBase,
  Collapse,
  Snackbar,
  Alert,
  Menu,
  MenuItem,
  ListItemIcon
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ExpandMore as ExpandMoreIcon,
  Place as PlaceIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
  MoreVert as MoreVertIcon
} from '@mui/icons-material';
import Layout from '../../components/Layout/Layout';
import { Client, Site } from '../../models/Quote';
import { apiService } from '../../services/api-service';
import { generateClientId } from '../../utils/id-generator';
import CustomNumberInput from '../../components/CustomNumberInput/CustomNumberInput';
import './ClientsPage.scss';

const API_BASE_URL = process.env.REACT_APP_API_URL;

interface ClientsPageProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

const ClientsPage: React.FC<ClientsPageProps> = ({ currentPath, onNavigate }) => {
  // State for clients data
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  // State for dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentClient, setCurrentClient] = useState<Partial<Client>>({
    name: '',
    sites: [],
    Taux_marge: 0
  });

  // State for new site
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteAddress, setNewSiteAddress] = useState('');

  // State for snackbar
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const [expandedClient, setExpandedClient] = useState<string | null>(null);

  const [originalClientSites, setOriginalClientSites] = useState<Site[]>([]); // Store original sites when editing

  // Load clients on component mount
  useEffect(() => {
    loadClients();
  }, []);

  // Load all clients with their sites
  const loadClients = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/clients`);
      if (!response.ok) {
        throw new Error('Failed to fetch clients');
      }
      const clientsData = await response.json();

      // Fetch sites for each client
      const clientsWithSites = await Promise.all(
        clientsData.map(async (client: { id: string; name: string }) => {
          const sitesResponse = await fetch(`${API_BASE_URL}/sites/by-client?clientId=${client.id}`);
          const sites = sitesResponse.ok ? await sitesResponse.json() : [];
          return { ...client, sites };
        })
      );

      setClients(clientsWithSites);
      setFilteredClients(clientsWithSites);
    } catch (error) {
      console.error('Error loading clients:', error);
      showSnackbar('Erreur lors du chargement des clients', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Open dialog to add a new client
  const handleAddClient = () => {
    setCurrentClient({
      name: '',
      sites: [],
      Taux_marge: 0
    });
    setNewSiteName('');
    setNewSiteAddress('');
    setIsEditing(false);
    setDialogOpen(true);
  };

  // Add a new site (either locally for update, or trigger create for new client)
  const handleAddSite = async () => {
    if (!newSiteName.trim()) {
      showSnackbar('Le nom du site est requis', 'error');
      return;
    }

    if (isEditing) {
      // If editing, just add locally to the state for now
      const tempSite: Site = {
        id: `temp-${Date.now()}`, // Temporary ID for local state
        name: newSiteName.trim(),
        client_id: currentClient.id || '' // Ensure client_id is present
      };
      setCurrentClient(prev => ({
        ...prev,
        sites: [...(prev.sites || []), tempSite]
      }));
      setNewSiteName(''); // Clear input
    } else {
      // If creating a new client, this button shouldn't call the API directly.
      // The main save button handles site creation after client creation.
      // For consistency, let's also update the local state here.
       const tempSite: Site = {
        id: `temp-${Date.now()}`, // Temporary ID for local state
        name: newSiteName.trim(),
        client_id: '' // Will be set upon client creation
      };
       setCurrentClient(prev => ({
        ...prev,
        sites: [...(prev.sites || []), tempSite]
      }));
      setNewSiteName(''); // Clear input
      // We might show a message that the site will be created with the client.
      // showSnackbar('Site sera ajouté lors de la création du client', 'info');
    }
  };

  // Remove a site (locally during editing)
  const handleRemoveSite = (siteIdToRemove: string) => {
    if (!isEditing && !currentClient.id) {
        // If creating a new client, just remove locally
        setCurrentClient(prev => ({
            ...prev,
            sites: (prev.sites || []).filter(site => site.id !== siteIdToRemove)
        }));
        return;
    }

    // If editing an existing client, also remove locally
    setCurrentClient(prev => ({
      ...prev,
      sites: (prev.sites || []).filter(site => site.id !== siteIdToRemove)
    }));
    // Note: The actual deletion API call happens in handleUpdateClientAndSites
  };

  // Save client (either create new or update existing)
  const handleSave = () => {
    if (isEditing) {
      handleUpdateClientAndSites();
    } else {
      handleCreateClientAndSite(); // Renamed the original save function
    }
  };

  // Renamed function for creating a NEW client and its first site
  const handleCreateClientAndSite = async () => {
    if (!currentClient.name?.trim()) {
      showSnackbar('Le nom du client est requis', 'error');
      return;
    }

    if (!newSiteName.trim()) {
      showSnackbar('Le nom du site est requis', 'error');
      return;
    }

    try {
      setLoading(true);

      // 1. Create client first
      const clientResponse = await fetch(`${API_BASE_URL}/clients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: currentClient.name.trim(),
          Taux_marge: currentClient.Taux_marge || 0
        })
      });

      if (!clientResponse.ok) {
        throw new Error('Failed to create client');
      }

      const newClient = await clientResponse.json();

      // 2. Create the site with the new client's ID
      const siteResponse = await fetch(`${API_BASE_URL}/sites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newSiteName.trim(),
          client_id: newClient.id
        })
      });

      if (!siteResponse.ok) {
        await fetch(`${API_BASE_URL}/clients/${newClient.id}`, { method: 'DELETE' });
        throw new Error('Failed to create site');
      }

      showSnackbar('Client et site créés avec succès', 'success');
      handleCloseDialog();
      await loadClients();
    } catch (error) {
      console.error('Error creating client and site:', error);
      showSnackbar('Erreur lors de la création du client et du site', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Function to handle updating an existing client and its sites
  const handleUpdateClientAndSites = async () => {
    if (!currentClient || !currentClient.id) {
      console.error('Update error: No current client ID');
      showSnackbar('Erreur: Client non identifiable pour la mise à jour', 'error');
      return;
    }

    if (!currentClient.name?.trim()) {
      showSnackbar('Le nom du client est requis', 'error');
      return;
    }

    setLoading(true);
    try {
      // 1. Update Client Name
      const clientUpdateResponse = await fetch(`${API_BASE_URL}/clients/${currentClient.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: currentClient.name.trim(),
          Taux_marge: currentClient.Taux_marge || 0
        })
      });

      if (!clientUpdateResponse.ok) {
        throw new Error('Failed to update client name');
      }

      // 2. Manage Sites (Add new, Delete removed)
      const currentSites = currentClient.sites || [];
      const originalSites = originalClientSites;

      const sitesToAdd = currentSites.filter(cs => !originalSites.some(os => os.id === cs.id));
      const sitesToDelete = originalSites.filter(os => !currentSites.some(cs => cs.id === os.id));

      // Add new sites
      await Promise.all(sitesToAdd.map(site =>
        fetch(`${API_BASE_URL}/sites`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: site.name, client_id: currentClient.id })
        })
      ));

      // Delete removed sites
      await Promise.all(sitesToDelete.map(site =>
        fetch(`${API_BASE_URL}/sites/${site.id}`, {
          method: 'DELETE'
        })
      ));

      showSnackbar('Client mis à jour avec succès', 'success');
      handleCloseDialog();
      await loadClients();

    } catch (error) {
      console.error('Error updating client and sites:', error);
      showSnackbar('Erreur lors de la mise à jour du client', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Close dialog and reset form
  const handleCloseDialog = () => {
    setDialogOpen(false);
    setCurrentClient({
      name: '',
      sites: [],
      Taux_marge: 0
    });
    setNewSiteName('');
    setIsEditing(false);
  };

  // Show snackbar with message
  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  // Close snackbar
  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, client: Client) => {
    setAnchorEl(event.currentTarget);
    setSelectedClient(client);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedClient(null);
  };

  const handleEditClient = (client: Client) => {
    setCurrentClient(client); // Load current data
    setOriginalClientSites(client.sites || []); // Store original sites for comparison
    setIsEditing(true);
    setNewSiteName(''); // Clear new site name field
    setDialogOpen(true);
    handleMenuClose();
  };

  const handleDeleteClient = async (client: Client) => {
    try {
      setLoading(true);
      await fetch(`${API_BASE_URL}/clients/${client.id}`, {
        method: 'DELETE'
      });
      showSnackbar('Client supprimé avec succès', 'success');
      await loadClients();
    } catch (error) {
      console.error('Error deleting client:', error);
      showSnackbar('Erreur lors de la suppression du client', 'error');
    } finally {
      setLoading(false);
      handleMenuClose();
    }
  };

  return (
    <Layout currentPath={currentPath} onNavigate={onNavigate}>
        <Box sx={{ display: 'flex', position: 'relative', width: '100%',height: '80px', backgroundColor: '#1976d2' , color: 'white'}} className="page-header">
        <Box sx={{ position: 'absolute', left: 0 , display: 'flex', alignItems: 'center',gap: 25 }}>
          <img
            src={logo}
            alt="Logo"
            style={{ height: '60px' }}
          />
          <Typography variant="h6" className="header-title">
            Clients et Sites
          </Typography>
        </Box>
         </Box>

      <Container maxWidth="lg" sx={{ mb: 4 }}>
        <Paper sx={{ p: 3, borderRadius: 2 }}>
          <Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 3
          }}>
            <Typography variant="h6">
              CLIENTS ET SITES
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                placeholder="Rechercher un client"
                size="small"
                sx={{
                  width: 250,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 1
                  }
                }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleAddClient}
                disabled={loading}
                sx={{
                  bgcolor: '#1976d2',
                  '&:hover': { bgcolor: '#1565c0' }
                }}
              >
                Nouveau Client
              </Button>
            </Box>
          </Box>

          <Box sx={{ mt: 2 }}>
            {loading ? (
              <Box sx={{ textAlign: 'center', py: 3 }}>
                Chargement...
              </Box>
            ) : filteredClients.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 3 }}>
                Aucun client trouvé
              </Box>
            ) : (
              filteredClients.map((client) => (
                <Paper
                  key={client.id}
                  elevation={1}
                  sx={{
                    mb: 2,
                    overflow: 'hidden',
                    border: '1px solid #e0e0e0'
                  }}
                >
                  <Box sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    p: 2,
                    '&:hover': { bgcolor: '#f5f5f5' }
                  }}>
                    <Box>
                      <Typography>
                        {client.name} <Typography component="span" color="text.secondary">#{client.id}</Typography>
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <IconButton
                        size="small"
                        onClick={() => setExpandedClient(expandedClient === client.id ? null : client.id)}
                      >
                        {expandedClient === client.id ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuClick(e, client)}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </Box>
                  </Box>
                  <Collapse in={expandedClient === client.id}>
                    <Box sx={{ px: 2, pb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Sites ({client.sites?.length || 0})
                        </Typography>
                      </Box>
                      {client.sites?.map((site) => (
                        <Box
                          key={site.id}
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            p: 1,
                            borderRadius: 1,
                            '&:hover': { bgcolor: '#f5f5f5' }
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <PlaceIcon fontSize="small" color="action" />
                            <Typography>{site.name}</Typography>
                          </Box>
                          <Box>
                            <IconButton size="small">
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" color="error">
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  </Collapse>
                </Paper>
              ))
            )}
          </Box>
        </Paper>
      </Container>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        {selectedClient?.sites?.map((site) => (
          <MenuItem key={site.id} disabled>
            <ListItemText primary={site.name} />
          </MenuItem>
        ))}
        <Divider />
        <MenuItem onClick={() => selectedClient && handleEditClient(selectedClient)}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Modifier</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => selectedClient && handleDeleteClient(selectedClient)}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Supprimer</ListItemText>
        </MenuItem>
      </Menu>

      {/* Add/Edit Client Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {isEditing ? 'Modifier le client' : 'Nouveau Client'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Nom du client"
            type="text"
            fullWidth
            value={currentClient.name}
            onChange={(e) => setCurrentClient({ ...currentClient, name: e.target.value })}
          />
          <CustomNumberInput
            label="Taux de Marge"
            value={currentClient.Taux_marge || 0}
            onChange={(value) => setCurrentClient({ ...currentClient, Taux_marge: value })}
            step={0.01}
            min={0}
            fullWidth
            margin="dense"
            variant="outlined"
          />
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              label="Nom du site"
              size="small"
              fullWidth
              value={newSiteName}
              onChange={(e) => setNewSiteName(e.target.value)}
            />
            <Button
              variant="outlined"
              onClick={handleAddSite} // Calls the updated function
              disabled={!newSiteName.trim()}
            >
              Ajouter
            </Button>
          </Box>
          <List>
            {currentClient.sites?.map((site) => (
              <ListItem
                key={site.id} // Use site.id as key
                secondaryAction={
                  <IconButton
                    edge="end"
                    onClick={() => handleRemoveSite(site.id)} // Calls the updated function
                  >
                    <DeleteIcon />
                  </IconButton>
                }
              >
                <ListItemText primary={site.name} />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Annuler</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={loading || !currentClient.name?.trim()}
          >
            {loading ? 'Enregistrement...' : (isEditing ? 'Mettre à jour' : 'Enregistrer')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
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
    </Layout>
  );
};

export default ClientsPage;
