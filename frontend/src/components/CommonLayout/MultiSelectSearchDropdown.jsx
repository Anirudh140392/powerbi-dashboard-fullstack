import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  Checkbox,
  Popover,
  InputAdornment,
  IconButton,
  Divider
} from '@mui/material';
import {
  Search as SearchIcon,
  KeyboardArrowDown as ArrowDownIcon,
  Close as CloseIcon
} from '@mui/icons-material';

export default function MultiSelectSearchDropdown({
  label,
  options = [],
  value = 'All',
  onChange,
  minWidth = 180
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const open = Boolean(anchorEl);

  // Normalize current selected items as an array
  const selectedArray = useMemo(() => {
    if (value === 'All' || (Array.isArray(value) && value.includes('All'))) {
      return options;
    }
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim()) {
      return [value];
    }
    return [];
  }, [value, options]);

  const isAllSelected = options.length > 0 && selectedArray.length === options.length;
  const isSomeSelected = selectedArray.length > 0 && !isAllSelected;

  // Formatting display text for the trigger button
  const displayValue = useMemo(() => {
    if (value === 'All' || isAllSelected) return 'All';
    if (selectedArray.length === 0) return 'None';
    if (selectedArray.length === 1) return selectedArray[0];
    if (selectedArray.length === 2) return selectedArray.join(', ');
    return `${selectedArray.length} Selected`;
  }, [value, isAllSelected, selectedArray]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const q = searchTerm.toLowerCase();
    return options.filter(opt => String(opt).toLowerCase().includes(q));
  }, [options, searchTerm]);

  const handleOpen = (e) => {
    setAnchorEl(e.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setSearchTerm('');
  };

  const handleToggle = (option) => {
    if (!onChange) return;

    let newSelected;
    if (selectedArray.includes(option)) {
      newSelected = selectedArray.filter(item => item !== option && item !== 'All');
    } else {
      newSelected = [...selectedArray.filter(item => item !== 'All'), option];
    }

    if (newSelected.length === options.length && options.length > 0) {
      onChange('All');
    } else {
      onChange(newSelected);
    }
  };

  const handleSelectAll = () => {
    if (!onChange) return;

    if (isAllSelected) {
      onChange([]);
    } else {
      onChange('All');
    }
  };

  return (
    <Box sx={{ position: 'relative', minWidth }}>
      {/* Floating Label */}
      {label && (
        <Typography
          component="label"
          sx={{
            position: 'absolute',
            top: '-8px',
            left: '10px',
            bgcolor: '#ffffff',
            px: '4px',
            fontSize: '11px',
            fontWeight: 600,
            color: open ? '#2563eb' : '#64748b',
            zIndex: 1,
            pointerEvents: 'none',
            lineHeight: 1,
            transition: 'color 0.15s ease'
          }}
        >
          {label}
        </Typography>
      )}

      {/* Select Trigger Control */}
      <Box
        onClick={handleOpen}
        sx={{
          height: '38px',
          px: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: '#ffffff',
          border: '1px solid',
          borderColor: open ? '#2563eb' : '#cbd5e1',
          borderRadius: '8px',
          cursor: 'pointer',
          boxShadow: open ? '0 0 0 2px rgba(37, 99, 235, 0.15)' : 'none',
          transition: 'all 0.15s ease',
          '&:hover': {
            borderColor: open ? '#2563eb' : '#94a3b8'
          }
        }}
      >
        <Typography
          sx={{
            fontSize: '13px',
            fontWeight: 600,
            color: selectedArray.length === 0 ? '#94a3b8' : '#1e293b',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            pr: 1
          }}
          title={displayValue}
        >
          {displayValue}
        </Typography>
        <ArrowDownIcon
          sx={{
            fontSize: '1.2rem',
            color: open ? '#2563eb' : '#64748b',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            flexShrink: 0
          }}
        />
      </Box>

      {/* Dropdown Menu Popover */}
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left'
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left'
        }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.8,
              width: Math.max(anchorEl?.offsetWidth || 220, 240),
              maxHeight: 340,
              borderRadius: '12px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e2e8f0',
              p: 1.5,
              display: 'flex',
              flexDirection: 'column',
              gap: 1
            }
          }
        }}
      >
        {/* Search Input */}
        <TextField
          size="small"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          autoFocus
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: '#94a3b8', fontSize: '1.1rem' }} />
              </InputAdornment>
            ),
            endAdornment: searchTerm ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearchTerm('')} sx={{ p: 0.2 }}>
                  <CloseIcon sx={{ fontSize: '0.9rem', color: '#94a3b8' }} />
                </IconButton>
              </InputAdornment>
            ) : null
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '8px',
              fontSize: '13px',
              bgcolor: '#f8fafc',
              '& fieldset': { borderColor: '#e2e8f0' },
              '&:hover fieldset': { borderColor: '#cbd5e1' },
              '&.Mui-focused fieldset': { borderColor: '#2563eb' }
            }
          }}
        />

        {/* Select All Option */}
        <Box
          onClick={handleSelectAll}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1,
            py: 0.5,
            borderRadius: '6px',
            cursor: 'pointer',
            userSelect: 'none',
            '&:hover': { bgcolor: '#f1f5f9' }
          }}
        >
          <Checkbox
            size="small"
            checked={isAllSelected}
            indeterminate={isSomeSelected}
            sx={{ p: 0.2, color: '#94a3b8', '&.Mui-checked, &.MuiCheckbox-indeterminate': { color: '#2563eb' } }}
          />
          <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
            Select All
          </Typography>
          <Typography sx={{ fontSize: '11px', color: '#64748b', ml: 'auto', fontWeight: 600 }}>
            ({selectedArray.length}/{options.length})
          </Typography>
        </Box>

        <Divider sx={{ my: 0.2, borderColor: '#f1f5f9' }} />

        {/* Options List */}
        <Box
          sx={{
            maxHeight: 200,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 0.2,
            pr: 0.5,
            '&::-webkit-scrollbar': { width: '5px' },
            '&::-webkit-scrollbar-thumb': { bgcolor: '#cbd5e1', borderRadius: '3px' }
          }}
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => {
              const isChecked = selectedArray.includes(option);
              return (
                <Box
                  key={option}
                  onClick={() => handleToggle(option)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 1,
                    py: 0.6,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    bgcolor: isChecked ? '#eff6ff' : 'transparent',
                    '&:hover': { bgcolor: isChecked ? '#dbeafe' : '#f8fafc' },
                    transition: 'background-color 0.12s ease'
                  }}
                >
                  <Checkbox
                    size="small"
                    checked={isChecked}
                    sx={{ p: 0.2, color: '#cbd5e1', '&.Mui-checked': { color: '#2563eb' } }}
                  />
                  <Typography
                    sx={{
                      fontSize: '13px',
                      fontWeight: isChecked ? 600 : 500,
                      color: isChecked ? '#1e40af' : '#334155',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                    title={option}
                  >
                    {option}
                  </Typography>
                </Box>
              );
            })
          ) : (
            <Typography sx={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', py: 2, fontStyle: 'italic' }}>
              No matching options
            </Typography>
          )}
        </Box>
      </Popover>
    </Box>
  );
}
