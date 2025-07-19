import React from 'react';
import { Box, IconButton, TextField } from '@mui/material';
import { Add as AddIcon, Remove as RemoveIcon } from '@mui/icons-material';
import './CustomNumberInput.scss';

interface CustomNumberInputProps {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  min?: number;
  max?: number;
  step?: number;
  fullWidth?: boolean;
  disabled?: boolean;
  variant?: 'outlined' | 'filled' | 'standard';
  margin?: 'none' | 'dense' | 'normal';
  displayOnly?: boolean; // New prop
}

const CustomNumberInput: React.FC<CustomNumberInputProps> = ({
  value,
  onChange,
  label,
  min = 0,
  max,
  step = 1,
  fullWidth = false,
  disabled = false,
  variant = 'outlined',
  margin = 'dense',
  displayOnly = false // New prop
}) => {
  if (displayOnly) {
    return (
      <Box className="custom-number-input display-only" sx={{ display: 'flex', flexDirection: 'column', width: fullWidth ? '100%' : 'auto' }}>
        {label && <span className="custom-number-label" style={{ fontWeight: 500, marginBottom: 2 }}>{label}</span>}
        <span className="custom-number-value" style={{ padding: '8.5px 14px', background: '#f5f5f5', borderRadius: 4, color: '#888', minHeight: 38 }}>{value}</span>
      </Box>
    );
  }

  const handleIncrease = () => {
    if (max === undefined || value < max) {
      onChange(value + step);
    }
  };

  const handleDecrease = () => {
    if (value > min) {
      onChange(value - step);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    if (!isNaN(newValue)) {
      if (max !== undefined && newValue > max) {
        onChange(max);
      } else if (newValue < min) {
        onChange(min);
      } else {
        onChange(newValue);
      }
    }
  };

  return (
    <Box className="custom-number-input" sx={{ display: 'inline-flex', alignItems: 'center', width: fullWidth ? '100%' : 'auto' }}>
      <TextField
        type="number"
        value={value}
        onChange={handleInputChange}
        label={label}
        variant={variant}
        margin={margin}
        disabled={disabled}
        fullWidth={fullWidth}
        InputProps={{
          inputProps: {
            min,
            max,
            step
          },
          startAdornment: (
            <IconButton
              size="small"
              onClick={handleDecrease}
              disabled={disabled || value <= min}
              className="number-control-button decrease-button"
            >
              <RemoveIcon fontSize="small" />
            </IconButton>
          ),
          endAdornment: (
            <IconButton
              size="small"
              onClick={handleIncrease}
              disabled={disabled || (max !== undefined && value >= max)}
              className="number-control-button increase-button"
            >
              <AddIcon fontSize="small" />
            </IconButton>
          )
        }}
      />
    </Box>
  );
};

export default CustomNumberInput;