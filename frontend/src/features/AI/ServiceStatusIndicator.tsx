/**
 * OptiPlan 360 - Service Status Indicator Component
 * Compact servis durum göstergesi ve mini dashboard
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Chip,
  IconButton,
  Popover,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Button,
  Tooltip,
  CircularProgress,
  Badge
} from '@mui/material';
import {
  CheckCircle as HealthyIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandIcon,
  Settings as SettingsIcon,
  Cloud as CloudIcon,
  Speed as SpeedIcon
} from '@mui/icons-material';
import { integrationService, type HealthStatus } from '../../services/aiIntegrationService';

interface ServiceStatusIndicatorProps {
  variant?: 'compact' | 'detailed' | 'minimal';
  showPopover?: boolean;
  refreshInterval?: number;
  onStatusChange?: (status: 'healthy' | 'degraded' | 'unhealthy') => void;
}

export const ServiceStatusIndicator: React.FC<ServiceStatusIndicatorProps> = ({
  variant = 'compact',
  showPopover = true,
  refreshInterval = 30000,
  onStatusChange
}) => {
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchHealthStatus = useCallback(async () => {
    setLoading(true);
    try {
      const status = await integrationService.getHealthStatus();
      setHealthStatus(status);
      setLastUpdate(new Date());
      
      if (onStatusChange) {
        onStatusChange(status.status);
      }
    } catch (err) {
      console.error('Health check failed:', err);
      // Keep previous status but mark as potentially stale
    } finally {
      setLoading(false);
    }
  }, [onStatusChange]);

  useEffect(() => {
    fetchHealthStatus();
    const interval = setInterval(fetchHealthStatus, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchHealthStatus, refreshInterval]);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    if (showPopover) {
      setAnchorEl(event.currentTarget);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const getStatusColor = () => {
    if (!healthStatus) return 'default';
    switch (healthStatus.status) {
      case 'healthy':
        return 'success';
      case 'degraded':
        return 'warning';
      case 'unhealthy':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusIcon = () => {
    if (loading) {
      return <CircularProgress size={16} />;
    }
    
    if (!healthStatus) {
      return <ErrorIcon fontSize="small" />;
    }
    
    switch (healthStatus.status) {
      case 'healthy':
        return <HealthyIcon fontSize="small" />;
      case 'degraded':
        return <WarningIcon fontSize="small" />;
      case 'unhealthy':
        return <ErrorIcon fontSize="small" />;
      default:
        return <ErrorIcon fontSize="small" />;
    }
  };

  const getServiceCount = () => {
    if (!healthStatus) return 0;
    return Object.keys(healthStatus.services).length;
  };

  const getHealthyCount = () => {
    if (!healthStatus) return 0;
    return Object.values(healthStatus.services).filter(s => s.status === 'healthy').length;
  };

  // Minimal variant - just an icon
  if (variant === 'minimal') {
    return (
      <Tooltip title={`Durum: ${healthStatus?.status || 'Bilinmiyor'}`}>
        <Badge
          color={getStatusColor() as 'success' | 'warning' | 'error' | 'default'}
          variant="dot"
          overlap="circular"
        >
          <IconButton size="small" onClick={handleClick}>
            {getStatusIcon()}
          </IconButton>
        </Badge>
      </Tooltip>
    );
  }

  // Compact variant - chip with status
  if (variant === 'compact') {
    return (
      <>
        <Chip
          icon={getStatusIcon()}
          label={healthStatus?.status?.toUpperCase() || 'UNKNOWN'}
          color={getStatusColor() as 'success' | 'warning' | 'error' | 'default'}
          size="small"
          onClick={handleClick}
          clickable
          sx={{
            '& .MuiChip-icon': {
              color: 'inherit'
            }
          }}
        />

        <Popover
          open={Boolean(anchorEl)}
          anchorEl={anchorEl}
          onClose={handleClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right'
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right'
          }}
          PaperProps={{
            sx: { width: 320, maxHeight: 400 }
          }}
        >
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="subtitle1" fontWeight="bold">
                <CloudIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Servis Durumu
              </Typography>
              <IconButton size="small" onClick={fetchHealthStatus} disabled={loading}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Box>

            {healthStatus && (
              <>
                <Box sx={{ mb: 2 }}>
                  <Chip
                    label={healthStatus.status.toUpperCase()}
                    color={getStatusColor() as 'success' | 'warning' | 'error' | 'default'}
                    size="small"
                    sx={{ mb: 1 }}
                  />
                  <Typography variant="caption" display="block" color="textSecondary">
                    {getHealthyCount()}/{getServiceCount()} servis sağlıklı
                  </Typography>
                  <Typography variant="caption" display="block" color="textSecondary">
                    Son güncelleme: {lastUpdate.toLocaleTimeString('tr-TR')}
                  </Typography>
                </Box>

                <Divider sx={{ my: 1 }} />

                <List dense sx={{ maxHeight: 200, overflow: 'auto' }}>
                  {Object.entries(healthStatus.services).map(([name, service]) => (
                    <ListItem key={name} disablePadding sx={{ py: 0.5 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        {service.status === 'healthy' ? (
                          <HealthyIcon color="success" fontSize="small" />
                        ) : service.status === 'degraded' ? (
                          <WarningIcon color="warning" fontSize="small" />
                        ) : (
                          <ErrorIcon color="error" fontSize="small" />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={name.replace(/_/g, ' ')}
                        secondary={`${service.latency_ms.toFixed(0)}ms`}
                        primaryTypographyProps={{ variant: 'body2' }}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                    </ListItem>
                  ))}
                </List>

                <Divider sx={{ my: 1 }} />

                <Button
                  fullWidth
                  size="small"
                  variant="outlined"
                  startIcon={<SettingsIcon />}
                  href="/admin/health"
                >
                  Detaylı Görünüm
                </Button>
              </>
            )}
          </Paper>
        </Popover>
      </>
    );
  }

  // Detailed variant - full status bar
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.5,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: 2
      }}
    >
      {/* Overall Status */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {getStatusIcon()}
        <Box>
          <Typography variant="subtitle2" fontWeight="bold">
            {healthStatus?.status?.toUpperCase() || 'CHECKING'}
          </Typography>
          <Typography variant="caption" color="textSecondary">
            {getHealthyCount()}/{getServiceCount()} servis
          </Typography>
        </Box>
      </Box>

      <Divider orientation="vertical" flexItem />

      {/* Service List */}
      <Box sx={{ flex: 1, display: 'flex', gap: 1, overflow: 'hidden' }}>
        {healthStatus && Object.entries(healthStatus.services).slice(0, 4).map(([name, service]) => (
          <Tooltip
            key={name}
            title={`${name.replace(/_/g, ' ')}: ${service.latency_ms.toFixed(1)}ms`}
          >
            <Chip
              label={name.replace(/_/g, ' ').split(' ').pop()}
              color={
                service.status === 'healthy'
                  ? 'success'
                  : service.status === 'degraded'
                  ? 'warning'
                  : 'error'
              }
              size="small"
              variant="outlined"
              icon={
                service.status === 'healthy' ? (
                  <HealthyIcon />
                ) : service.status === 'degraded' ? (
                  <WarningIcon />
                ) : (
                  <ErrorIcon />
                )
              }
            />
          </Tooltip>
        ))}
        {healthStatus && Object.keys(healthStatus.services).length > 4 && (
          <Chip
            label={`+${Object.keys(healthStatus.services).length - 4}`}
            size="small"
            variant="outlined"
          />
        )}
      </Box>

      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        <Tooltip title="Yenile">
          <IconButton size="small" onClick={fetchHealthStatus} disabled={loading}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Detaylar">
          <IconButton size="small" onClick={handleClick}>
            <ExpandIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Popover for detailed view */}
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right'
        }}
        PaperProps={{
          sx: { width: 400, maxHeight: 500 }
        }}
      >
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Servis Detayları
          </Typography>
          
          {healthStatus && (
            <>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  Son Güncelleme: {lastUpdate.toLocaleString('tr-TR')}
                </Typography>
              </Box>

              <List>
                {Object.entries(healthStatus.services).map(([name, service]) => (
                  <ListItem key={name} divider>
                    <ListItemIcon>
                      {service.status === 'healthy' ? (
                        <HealthyIcon color="success" />
                      ) : service.status === 'degraded' ? (
                        <WarningIcon color="warning" />
                      ) : (
                        <ErrorIcon color="error" />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={name.replace(/_/g, ' ')}
                      secondary={
                        <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <SpeedIcon fontSize="small" />
                          {service.latency_ms.toFixed(1)}ms
                          <Typography variant="caption" color="textSecondary">
                            • {new Date(service.last_check).toLocaleTimeString('tr-TR')}
                          </Typography>
                        </Box>
                      }
                    />
                    <Chip
                      label={service.status}
                      color={
                        service.status === 'healthy'
                          ? 'success'
                          : service.status === 'degraded'
                          ? 'warning'
                          : 'error'
                      }
                      size="small"
                    />
                  </ListItem>
                ))}
              </List>

              <Button
                fullWidth
                variant="contained"
                startIcon={<SettingsIcon />}
                href="/admin/health"
                sx={{ mt: 1 }}
              >
                Admin Panel
              </Button>
            </>
          )}
        </Paper>
      </Popover>
    </Paper>
  );
};

// Compact toolbar version for app bars
export const ServiceStatusToolbar: React.FC = () => {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <ServiceStatusIndicator variant="compact" />
    </Box>
  );
};

// Status badge for individual services
export const ServiceStatusBadge: React.FC<{
  serviceName: string;
  status?: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  latency?: number;
}> = ({ serviceName, status = 'unknown', latency }) => {
  const getColor = () => {
    switch (status) {
      case 'healthy':
        return 'success';
      case 'degraded':
        return 'warning';
      case 'unhealthy':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Tooltip
      title={
        latency
          ? `${serviceName}: ${status} (${latency.toFixed(1)}ms)`
          : `${serviceName}: ${status}`
      }
    >
      <Chip
        label={serviceName}
        color={getColor() as 'success' | 'warning' | 'error' | 'default'}
        size="small"
        variant={status === 'unknown' ? 'outlined' : 'filled'}
      />
    </Tooltip>
  );
};

export default ServiceStatusIndicator;
