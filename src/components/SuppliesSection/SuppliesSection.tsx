import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
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
  MenuItem
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import { SupplyItem } from '../../models/Quote';
import { apiService } from '../../services/api-service';
import { calculateSupplyItemTotal } from '../../utils/calculations';
import CustomNumberInput from '../CustomNumberInput/CustomNumberInput';
import './SuppliesSection.scss';

interface SuppliesSectionProps {
  items?: SupplyItem[];
  description: string;
  exchangeRate: number;
  marginRate: number;
  totalHT: number;
  onAddItem: (item: Omit<SupplyItem, 'id'>) => void;
  onRemoveItem: (id: string) => void;
  onUpdateDescription: (description: string) => void;
  onUpdateExchangeRate: (rate: number) => void;
  onUpdateMarginRate: (rate: number) => void;
  onUpdateSupplyItem: (item: SupplyItem) => void;
}

const SuppliesSection: React.FC<SuppliesSectionProps> = ({
  items = [],
  description,
  exchangeRate,
  marginRate,
  totalHT,
  onAddItem,
  onRemoveItem,
  onUpdateDescription,
  onUpdateExchangeRate,
  onUpdateMarginRate,
  onUpdateSupplyItem
}) => {
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [catalogItems, setCatalogItems] = useState<SupplyItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<SupplyItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState<SupplyItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [customPriceDialogOpen, setCustomPriceDialogOpen] = useState(false);
  const [customPrice, setCustomPrice] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [editPriceDialogOpen, setEditPriceDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SupplyItem | null>(null);
  const [editPrice, setEditPrice] = useState<number>(0);

  // Load catalog items on component mount
  useEffect(() => {
    const loadCatalogItems = async () => {
      try {
        setIsLoading(true);
        const loadedItems = await apiService.getSupplies();

        // Map API response to expected structure if needed
        const mappedItems = loadedItems.map(item => {
          const itemAny = item as any;
          const description = itemAny.description || itemAny.Description || itemAny.name || itemAny.Name || '';

          return {
            id: itemAny.id,
            description: description,
            priceEuro: parseFloat(itemAny.price) || 0,
            quantity: 1
          } as SupplyItem;
        });

        setCatalogItems(mappedItems);
        setFilteredItems(mappedItems);
      } catch (error) {
        console.error('Error loading catalog items:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCatalogItems();
  }, []);

  // Filter items based on search term
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredItems(catalogItems);
    } else {
      const filtered = catalogItems.filter(item =>
        item.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredItems(filtered);
    }
  }, [searchTerm, catalogItems]);

  // Calculate dollar prices for all items when rates change
  useEffect(() => {
    const itemsWithDollarPrices = items.map(item =>
      calculateSupplyItemTotal(item, exchangeRate, marginRate)
    );
    // Update items with calculated dollar prices
    itemsWithDollarPrices.forEach(item => {
      const existingItem = items.find(i => i.id === item.id);
      if (existingItem) {
        existingItem.priceDollar = item.priceDollar;
        existingItem.unitPriceDollar = item.unitPriceDollar;
        existingItem.totalPriceDollar = item.totalPriceDollar;
      }
    });
  }, [items, exchangeRate, marginRate]);

  // Handle opening the search dialog
  const handleOpenSearchDialog = () => {
    setSearchDialogOpen(true);
    setSearchTerm('');
    setSelectedItem(null);
    setQuantity(1);
  };

  // Handle closing the search dialog
  const handleCloseSearchDialog = () => {
    setSearchDialogOpen(false);
  };

  // Handle selecting an item from the catalog
  const handleSelectItem = (item: SupplyItem) => {
    setSelectedItem(item);
  };

  // Handle closing the custom price dialog
  const handleCloseCustomPriceDialog = () => {
    setCustomPriceDialogOpen(false);
    setCustomPrice(0);
  };

  // Handle adding an item with custom price
  const handleAddItemWithCustomPrice = () => {
    if (selectedItem && customPrice > 0) {
      const itemWithCustomPrice = {
        ...selectedItem,
        priceEuro: customPrice
      };
      const calculatedItem = calculateSupplyItemTotal(itemWithCustomPrice, exchangeRate, marginRate);
      onAddItem({
        description: calculatedItem.description,
        quantity: quantity,
        priceEuro: calculatedItem.priceEuro,
        priceDollar: calculatedItem.priceDollar,
        unitPriceDollar: calculatedItem.unitPriceDollar,
        totalPriceDollar: calculatedItem.totalPriceDollar
      });
      handleCloseCustomPriceDialog();
    }
  };

  // Handle adding a regular item
  const handleAddItem = () => {
    if (selectedItem) {
      const calculatedItem = calculateSupplyItemTotal(selectedItem, exchangeRate, marginRate);
      onAddItem({
        description: calculatedItem.description,
        quantity: quantity,
        priceEuro: calculatedItem.priceEuro,
        priceDollar: calculatedItem.priceDollar,
        unitPriceDollar: calculatedItem.unitPriceDollar,
        totalPriceDollar: calculatedItem.totalPriceDollar
      });
      handleCloseSearchDialog();
    }
  };

  const handleOpenEditPriceDialog = (item: SupplyItem) => {
    setEditingItem(item);
    setEditPrice(item.priceEuro);
    setEditPriceDialogOpen(true);
  };

  const handleCloseEditPriceDialog = () => {
    setEditPriceDialogOpen(false);
    setEditingItem(null);
    setEditPrice(0);
  };

  const handleUpdatePrice = () => {
    if (editingItem) {
      const updatedItem = {
        ...editingItem,
        priceEuro: editPrice
      };
      onUpdateSupplyItem(updatedItem);
      handleCloseEditPriceDialog();
    }
  };

  return (
    <Paper className="supplies-section" elevation={2}>
      <Typography variant="h6" className="section-title">
        FOURNITURES
      </Typography>

      <TextField
        select
        fullWidth
        label="Description des fournitures"
        value={description}
        onChange={(e) => onUpdateDescription(e.target.value)}
        variant="outlined"
        margin="none"
        className="description-field"
      >
        <MenuItem value="Extension des raccordements électriques, frigorifique et condensat">
          Extension des raccordements électriques, frigorifique et condensat
        </MenuItem>
      </TextField>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }} className="rates-container">
        <Box className="rates-container-item" sx={{ flex: '1 1 50px' }}>
          <CustomNumberInput
            value={exchangeRate}
            onChange={onUpdateExchangeRate}
            label="Taux de change"
            min={0}
            step={0.01}
            fullWidth
          />
        </Box>
        <Box className="rates-container-item" sx={{ flex: '1 1 50px' }}>
          <CustomNumberInput
            value={marginRate}
            onChange={onUpdateMarginRate}
            label="Taux de marge"
            min={0}
            max={1}
            step={0.01}
            fullWidth
          />
        </Box>
      </Box>

      <Box className="item-actions">
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleOpenSearchDialog}
          className="add-item-button"
        >
          Ajouter un article
        </Button>
      </Box>

      <TableContainer className="items-table-container">
        <Table size="small" aria-label="supplies table">
          <TableHead>
            <TableRow>
              <TableCell>Description</TableCell>
              <TableCell align="right">Qté</TableCell>
              <TableCell align="right">PR €</TableCell>
              <TableCell align="right">PR $</TableCell>
              <TableCell align="right">PV/u $</TableCell>
              <TableCell align="right">PV $ Total HT</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  Aucun article ajouté
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.description}</TableCell>
                  <TableCell align="right">{item.quantity}</TableCell>
                  <TableCell align="right">{Number(item.priceEuro || 0).toFixed(2)}</TableCell>
                  <TableCell align="right">{Number(item.priceDollar || 0).toFixed(2)}</TableCell>
                  <TableCell align="right">{Number(item.unitPriceDollar || 0).toFixed(2)}</TableCell>
                  <TableCell align="right">{Number(item.totalPriceDollar || 0).toFixed(2)}</TableCell>
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => handleOpenEditPriceDialog(item)}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => onRemoveItem(item.id)}
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

      <Box className="total-container">
        <Typography variant="subtitle1" className="total-label">
          TOTAL FOURNITURE $ HT:
        </Typography>
        <Typography variant="subtitle1" className="total-value">
          {Number(totalHT ?? 0).toFixed(2)}
        </Typography>
      </Box>

      {/* Item Search Dialog */}
      <Dialog
        open={searchDialogOpen}
        onClose={handleCloseSearchDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Ajouter un article</DialogTitle>
        <DialogContent>
          <Box className="search-container">
            <TextField
              fullWidth
              label="Rechercher un article"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              variant="outlined"
              margin="normal"
              InputProps={{
                startAdornment: <SearchIcon color="action" />
              }}
            />
          </Box>

          <TableContainer className="search-results-container">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Description</TableCell>
                  <TableCell align="right">Prix €</TableCell>
                  <TableCell align="center">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} align="center">
                      Aucun article trouvé
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => (
                    <TableRow
                      key={item.id}
                      className={selectedItem?.id === item.id ? 'selected-item' : ''}
                      onClick={() => handleSelectItem(item)}
                    >
                      <TableCell>{item.description}</TableCell>
                      <TableCell align="right">{Number(item.priceEuro || 0).toFixed(2)}</TableCell>
                      <TableCell align="center">
                        <Button
                          size="small"
                          variant="outlined"
                          color="primary"
                          onClick={() => handleSelectItem(item)}
                        >
                          Sélectionner
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {selectedItem && (
            <Box className="quantity-container">
              <Typography variant="subtitle1">
                Article sélectionné: {selectedItem.description}
              </Typography>
              <CustomNumberInput
                label="Quantité"
                value={quantity}
                onChange={setQuantity}
                min={1}
                step={1}
                fullWidth
                margin="normal"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseSearchDialog} color="primary">
            Annuler
          </Button>
          <Button
            onClick={handleAddItem}
            color="primary"
            variant="contained"
            disabled={!selectedItem}
          >
            Ajouter
          </Button>
        </DialogActions>
      </Dialog>

      {/* Custom Price Dialog */}
      <Dialog
        open={customPriceDialogOpen}
        onClose={() => setCustomPriceDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Entrer un prix personnalisé</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" paragraph>
            L'article "{selectedItem?.description}" a un prix de 0.00€.
            Veuillez entrer un prix personnalisé pour cet article.
          </Typography>
          <CustomNumberInput
            label="Prix (€)"
            value={customPrice}
            onChange={setCustomPrice}
            min={0.01}
            step={0.01}
            fullWidth
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCustomPriceDialogOpen(false)} color="primary">
            Annuler
          </Button>
          <Button
            onClick={handleAddItemWithCustomPrice}
            color="primary"
            variant="contained"
            disabled={customPrice <= 0}
          >
            Ajouter
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Price Dialog */}
      <Dialog
        open={editPriceDialogOpen}
        onClose={handleCloseEditPriceDialog}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Modifier le prix</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" paragraph>
            Article: {editingItem?.description}
          </Typography>
          <CustomNumberInput
            label="Prix (€)"
            value={editPrice}
            onChange={setEditPrice}
            min={0.01}
            step={0.01}
            fullWidth
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEditPriceDialog} color="primary">
            Annuler
          </Button>
          <Button
            onClick={handleUpdatePrice}
            color="primary"
            variant="contained"
            disabled={editPrice <= 0}
          >
            Mettre à jour
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default SuppliesSection;