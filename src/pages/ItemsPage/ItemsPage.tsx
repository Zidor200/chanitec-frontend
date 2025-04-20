import React, { useState, useEffect, useRef, FC } from 'react';
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
  Tooltip,
  Snackbar,
  Alert
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  FileUpload as FileUploadIcon
} from '@mui/icons-material';
import * as XLSX from 'xlsx';
import Layout from '../../components/Layout/Layout';
import { SupplyItem } from '../../models/Quote';
import { itemsApi } from '../../services/api';
import './ItemsPage.scss';
import { v4 as uuidv4 } from 'uuid';
import CustomNumberInput from '../../components/CustomNumberInput/CustomNumberInput';

const API_BASE_URL =  'http://localhost:3001/api';

interface ItemsPageProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

interface ExcelItem {
  Description: string;
  price: number;
}

interface ProcessedItem {
  valid: boolean;
  rowIndex: number;
  item?: {
    description: string;
    priceEuro: number;
  };
  error?: string;
  rawData?: any;
}

interface ImportResultItem {
  rowIndex: number;
  item?: any;
  error?: string;
  rawData?: any;
}

interface ImportSummary {
  total: number;
  valid: number;
  invalid: number;
  imported: number;
  errors: number;
}

interface ImportResults {
  totalProcessed: number;
  successful: ImportResultItem[];
  failed: ImportResultItem[];
  summary: ImportSummary;
}

interface ProcessedExcelItem {
  description: string;
  priceEuro: number;
  rowIndex: number;
  isValid: boolean;
  validationError?: string;
  originalRow: {
    description: any;
    price: any;
  };
}

// Add type for worksheet with index signature
interface ExtendedWorksheet {
  [key: string]: any;
  '!ref'?: string;
}

// Add type for cell address
interface CellAddress {
  r: number;
  c: number;
}

const ItemsPage: FC<ItemsPageProps> = ({ currentPath, onNavigate }) => {
  // State for items data
  const [items, setItems] = useState<SupplyItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<SupplyItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // State for dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentItem, setCurrentItem] = useState<Partial<SupplyItem>>({
    description: '',
    priceEuro: 0
  });

  // State for loading and feedback
  const [loading, setLoading] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'info' | 'warning'>('success');

  // State for file import
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State for loading
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load items when component mounts
  useEffect(() => {
    loadItems();
  }, []);

  // Filter items when search term changes
  useEffect(() => {
    filterItems();
  }, [searchTerm, items]);

  // Load all items from API
  const loadItems = async () => {
    try {
      setLoading(true);
      const data = await itemsApi.getAllItems();

      // Transform the data to match our frontend structure
      const transformedItems = data.map((item: any) => ({
        id: item.id,
        description: item.description,
        priceEuro: item.price
      }));

      setItems(transformedItems);
      setFilteredItems(transformedItems);
    } catch (error) {
      console.error('Error loading items:', error);
      showSnackbar('Erreur lors du chargement des articles', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Filter items based on search term
  const filterItems = () => {
    if (!searchTerm.trim()) {
      setFilteredItems(items);
    } else {
      const filtered = items.filter(item =>
        item.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredItems(filtered);
    }
  };

  // Show snackbar with message
  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info' | 'warning') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  // Close snackbar
  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

  // Open dialog to add a new item
  const handleAddItem = () => {
    setCurrentItem({
      description: '',
      priceEuro: 0
    });
    setIsEditing(false);
    setDialogOpen(true);
  };

  // Close dialog
  const handleCloseDialog = () => {
    setDialogOpen(false);
  };

  // Handle input change in dialog
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCurrentItem({
      ...currentItem,
      [name]: name === 'priceEuro' ? parseFloat(value) : value
    });
  };

  // Save item (create or update)
  const handleSaveItem = async () => {
    if (!currentItem.description) {
      showSnackbar('La description est requise', 'error');
      return;
    }

    try {
      setLoading(true);
      const itemData = {
        description: currentItem.description,
        price: currentItem.priceEuro
      };

      if (isEditing && currentItem.id) {
        await itemsApi.updateItem(currentItem.id, itemData);
      } else {
        await itemsApi.createItem(itemData);
      }

      showSnackbar(`Article ${isEditing ? 'mis à jour' : 'créé'} avec succès`, 'success');
      handleCloseDialog();
      await loadItems();
    } catch (error) {
      showSnackbar(`Erreur lors de ${isEditing ? 'la mise à jour' : 'la création'} de l\'article`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Delete item
  const handleDeleteItem = async (id: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cet article ?')) {
      try {
        setDeletingId(id);
        await itemsApi.deleteItem(id);
        setItems(prevItems => prevItems.filter(item => item.id !== id));
        setFilteredItems(prevItems => prevItems.filter(item => item.id !== id));
        showSnackbar('Article supprimé avec succès', 'success');
      } catch (error) {
        showSnackbar('Erreur lors de la suppression de l\'article', 'error');
      } finally {
        setDeletingId(null);
      }
    }
  };

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  // Add this new function after handleSaveItem
  const handleImportItems = async (items: { description: string; priceEuro: number }[]) => {
    const results = {
      successful: [] as any[],
      failed: [] as any[],
      total: items.length,
      imported: 0
    };

    try {
      setLoading(true);

      // Process each item one by one
      for (const item of items) {
        try {
          // Validate item
          if (!item.description) {
            results.failed.push({
              item,
              error: 'La description est requise'
            });
            continue;
          }

          // Prepare item data (same structure as handleSaveItem)
          const itemData = {
            description: item.description,
            price: item.priceEuro
          };

          // Create item using the same API call as handleSaveItem
          const response = await itemsApi.createItem(itemData);

          results.successful.push({
            original: item,
            created: response
          });
          results.imported++;

          // Show progress
          showSnackbar(
            `Import en cours: ${results.imported}/${items.length} articles traités...`,
            'info'
          );
        } catch (error) {
          results.failed.push({
            item,
            error: `Erreur: ${(error as Error).message}`
          });
        }
      }

      // Show final results
      if (results.failed.length > 0) {
        if (results.successful.length > 0) {
          showSnackbar(
            `Import partiel: ${results.successful.length} articles importés, ${results.failed.length} échecs`,
            'warning' as const
          );
        } else {
          showSnackbar('Échec de l\'import: aucun article importé', 'error');
        }
        console.error('Failed imports:', results.failed);
      } else {
        showSnackbar(`${results.successful.length} articles importés avec succès`, 'success');
      }

      // Refresh the list
      await loadItems();
    } catch (error) {
      console.error('Error during import:', error);
      showSnackbar('Erreur lors de l\'import', 'error');
    } finally {
      setLoading(false);
    }

    return results;
  };

  // Update handleFileUpload function
  const handleFileUpload = async (file: File) => {
    try {
      setLoading(true);
      const reader = new FileReader();

      reader.onload = async (event: ProgressEvent<FileReader>) => {
        try {
          const data = event.target?.result;
          if (typeof data !== 'string') {
            throw new Error('Invalid file data');
          }

          // Read the Excel file
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];

          // Convert worksheet to JSON
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          // Skip header row and process data
          const processedItems: ProcessedExcelItem[] = [];
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i] as any[];
            if (!row || row.length < 2) continue;

            const description = String(row[0] || '').trim();
            if (!description) continue;

            let price = 0;
            const priceValue = row[1];
            if (typeof priceValue === 'number') {
              price = priceValue;
            } else if (typeof priceValue === 'string') {
              const cleanPrice = priceValue.replace(/[^0-9.,]/g, '').replace(',', '.');
              price = parseFloat(cleanPrice);
              if (isNaN(price)) price = 0;
            }

            const processedItem: ProcessedExcelItem = {
              description,
              priceEuro: price,
              rowIndex: i + 1,
              isValid: true,
              originalRow: {
                description: row[0],
                price: row[1]
              }
            };

            processedItems.push(processedItem);
          }

          if (processedItems.length > 0) {
            // Save each processed item individually
            let successCount = 0;
            let errorCount = 0;

            for (const item of processedItems) {
              try {
                // Create a new item using the API
                const response = await fetch(`${API_BASE_URL}/items`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    description: item.description,
                    price: item.priceEuro
                  })
                });

                if (!response.ok) {
                  throw new Error(`Failed to save item: ${response.statusText}`);
                }

                await response.json();
                successCount++;
              } catch (error) {
                errorCount++;
              }
            }

            // Show final summary
            showSnackbar(
              `Import terminé: ${successCount} articles importés avec succès, ${errorCount} erreurs`,
              successCount > 0 ? 'success' : 'error'
            );

            // Refresh the items list
            await loadItems();
          }

        } catch (error) {
          showSnackbar(
            'Erreur lors du traitement du fichier: ' + (error as Error).message,
            'error'
          );
        }
      };

      reader.readAsBinaryString(file);
    } catch (error) {
      showSnackbar(
        'Erreur lors de la lecture du fichier: ' + (error as Error).message,
        'error'
      );
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <Layout currentPath={currentPath} onNavigate={onNavigate}>
      <Box className="page-header">
        <Typography variant="h6" component="h1" className="page-title">
          GESTION DES ARTICLES
        </Typography>
      </Box>
      <Container className="items-page-container">
        <Paper elevation={2} className="items-paper">
          <Box className="items-header">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h6" className="section-title">
                ARTICLES DE FOURNITURE
              </Typography>
              <Typography variant="subtitle1" sx={{ color: 'text.secondary' }}>
                ({items.length} articles)
              </Typography>
            </Box>
            <Box className="search-and-add">
              <TextField
                label="Rechercher un article"
                variant="outlined"
                size="small"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-field"
              />
              <Button
                variant="contained"
                color="primary"
                startIcon={<AddIcon />}
                onClick={handleAddItem}
                disabled={loading}
              >
                Ajouter un article
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".xlsx,.xls"
                style={{ display: 'none' }}
              />
              <Button
                variant="outlined"
                color="primary"
                startIcon={<FileUploadIcon />}
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
              >
                Importer Excel
              </Button>
            </Box>
          </Box>

          <TableContainer className="items-table-container">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Description</TableCell>
                  <TableCell align="right">Prix (€)</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      Chargement...
                    </TableCell>
                  </TableRow>
                ) : filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      Aucun article trouvé
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell align="right">
                        {item.priceEuro ? Number(item.priceEuro).toFixed(2) : '0.00'}
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => {
                            setCurrentItem(item);
                            setIsEditing(true);
                            setDialogOpen(true);
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteItem(item.id)}
                          disabled={deletingId === item.id}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Container>

      {/* Dialog for adding/editing items */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {isEditing ? 'Modifier l\'article' : 'Ajouter un nouvel article'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            name="description"
            label="Description"
            type="text"
            fullWidth
            variant="outlined"
            value={currentItem.description}
            onChange={handleInputChange}
          />
          <TextField
            margin="dense"
            name="priceEuro"
            label="Prix (€)"
            type="number"
            fullWidth
            variant="outlined"
            value={currentItem.priceEuro}
            onChange={handleInputChange}
            inputProps={{ step: "0.01" }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Annuler</Button>
          <Button onClick={handleSaveItem} color="primary" variant="contained" disabled={loading}>
            {loading ? 'Enregistrement...' : 'Enregistrer'}
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

export default ItemsPage;