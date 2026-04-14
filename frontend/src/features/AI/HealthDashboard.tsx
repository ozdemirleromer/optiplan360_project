/**
 * OptiPlan 360 - Health Dashboard Component
 * Tüm servislerin sağlık durumu için dashboard UI
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  IconButton,
  Button,
  LinearProgress,
  CircularProgress,
  Paper,
  Alert,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  CheckCircle as HealthyIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Speed as SpeedIcon,
  Storage as StorageIcon,
  Timeline as TimelineIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon
} from '@mui/icons-material';
import { integrationService, type HealthStatus } from '../../services/aiIntegrationService';
import {
  appendHealthHistoryPoint,
  getHistoryServiceNames,
  type HealthHistoryPoint
} from './healthHistory';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface HealthDashboardProps {
  showDetailedMetrics?: boolean;
}


const COLORS = ['#4caf50', '#ff9800', '#f44336', '#2196f3', '#9c27b0'];

export const HealthDashboard: React.FC<HealthDashboardProps> = ({
  showDetailedMetrics = false
}) => {
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<HealthHistoryPoint[]>([]);

  const fetchHealthStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const status = await integrationService.getHealthStatus();
      setHealthStatus(status);
      setHistoryData((currentHistory) => appendHealthHistoryPoint(currentHistory, status));
    } catch {
      setError('Sağlık durumu alınamadı');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInitialize = async () => {
    try {
      await integrationService.initializeServices();
      setError(null);
      fetchHealthStatus();
    } catch {
      setError('Servis başlatma başarısız');
    }
  };

  useEffect(() => {
    fetchHealthStatus();
    const interval = setInterval(fetchHealthStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchHealthStatus]);

  const getOverallStatusIcon = () => {
    if (!healthStatus) return <CircularProgress size={48} />;
    switch (healthStatus.status) {
      case 'healthy':
        return <HealthyIcon sx={{ fontSize: 48, color: 'success.main' }} />;
      case 'degraded':
        return <WarningIcon sx={{ fontSize: 48, color: 'warning.main' }} />;
      case 'unhealthy':
        return <ErrorIcon sx={{ fontSize: 48, color: 'error.main' }} />;
      default:
        return <ErrorIcon sx={{ fontSize: 48, color: 'text.disabled' }} />;
    }
  };

  const getStatusColor = (status: string) => {
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

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Calculate overall metrics
  const calculateMetrics = () => {
    if (!healthStatus) return null;

    const services = Object.entries(healthStatus.services);
    const totalServices = services.length;
    const healthyServices = services.filter(([, s]) => s.status === 'healthy').length;
    const avgLatency = services.reduce((sum, [, s]) => sum + s.latency_ms, 0) / totalServices;

    return {
      totalServices,
      healthyServices,
      degradedServices: services.filter(([, s]) => s.status === 'degraded').length,
      unhealthyServices: services.filter(([, s]) => s.status === 'unhealthy').length,
      avgLatency: avgLatency.toFixed(1),
      maxLatency: Math.max(...services.map(([, s]) => s.latency_ms)).toFixed(1)
    };
  };

  const metrics = calculateMetrics();
  const chartServiceNames = getHistoryServiceNames(historyData);

  return (
    <Box sx={{ p: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {getOverallStatusIcon()}
          <Box>
            <Typography variant="h4">System Health</Typography>
            <Typography variant="body2" color="textSecondary">
              {healthStatus ? (
                `Son güncelleme: ${new Date(healthStatus.timestamp).toLocaleString('tr-TR')}`
              ) : (
                'Yükleniyor...'
              )}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            onClick={handleInitialize}
            startIcon={<SettingsIcon />}
            disabled={loading}
          >
            Servisleri Başlat
          </Button>
          <IconButton onClick={fetchHealthStatus} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Overview Cards */}
      {metrics && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="textSecondary">
                  Genel Durum
                </Typography>
                <Chip
                  label={healthStatus?.status.toUpperCase()}
                  color={getStatusColor(healthStatus?.status || 'unknown') as 'success' | 'warning' | 'error' | 'default'}
                  sx={{ mt: 1, fontSize: '1.2rem', fontWeight: 'bold' }}
                />
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="textSecondary">
                  Sağlıklı Servisler
                </Typography>
                <Typography variant="h3" color="success.main">
                  {metrics.healthyServices}/{metrics.totalServices}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="textSecondary">
                  Ortalama Latency
                </Typography>
                <Typography variant="h3">
                  {metrics.avgLatency}ms
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="textSecondary">
                  Max Latency
                </Typography>
                <Typography variant="h3" color={parseFloat(metrics.maxLatency) > 500 ? 'warning.main' : 'inherit'}>
                  {metrics.maxLatency}ms
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Tabs */}
      <Card>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab icon={<StorageIcon />} label="Servisler" />
          {showDetailedMetrics && <Tab icon={<TimelineIcon />} label="Metrikler" />}
          {showDetailedMetrics && <Tab icon={<SpeedIcon />} label="Performans" />}
        </Tabs>

        {/* Services Tab */}
        <CardContent>
          {activeTab === 0 && healthStatus && (
            <Grid container spacing={2}>
              {Object.entries(healthStatus.services).map(([name, service]) => (
                <Grid item xs={12} sm={6} md={4} key={name}>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'action.hover' }
                    }}
                    onClick={() => setSelectedService(name)}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="subtitle1" fontWeight="medium">
                        {name.replace(/_/g, ' ').toUpperCase()}
                      </Typography>
                      {service.status === 'healthy' ? (
                        <HealthyIcon color="success" />
                      ) : service.status === 'degraded' ? (
                        <WarningIcon color="warning" />
                      ) : (
                        <ErrorIcon color="error" />
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Chip
                        label={service.status}
                        color={getStatusColor(service.status) as 'success' | 'warning' | 'error' | 'default'}
                        size="small"
                      />
                      <Chip
                        icon={<SpeedIcon />}
                        label={`${service.latency_ms.toFixed(1)}ms`}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                    <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                      Son kontrol: {new Date(service.last_check).toLocaleTimeString('tr-TR')}
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}

          {/* Metrics Tab */}
          {activeTab === 1 && showDetailedMetrics && (
            <Box sx={{ height: 400 }}>
              <Typography variant="subtitle2" gutterBottom>
                Son 24 Ölçüm Latency Grafiği
              </Typography>
              {historyData.length === 0 ? (
                <Alert severity="info" sx={{ mt: 2 }}>
                  Latency geçmişi ilk başarılı sağlık kontrolünden sonra oluşacak.
                </Alert>
              ) : (
                <ResponsiveContainer width="100%" height="90%">
                  <AreaChart data={historyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <RechartsTooltip />
                    {chartServiceNames.map((serviceName, index) => (
                      <Area
                        key={serviceName}
                        type="monotone"
                        dataKey={serviceName}
                        stroke={COLORS[index % COLORS.length]}
                        fill={COLORS[index % COLORS.length]}
                        fillOpacity={0.18}
                        name={serviceName.replace(/_/g, ' ').toUpperCase()}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Box>
          )}

          {/* Performance Tab */}
          {activeTab === 2 && showDetailedMetrics && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, height: 300 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Servis Dağılımı
                  </Typography>
                  <ResponsiveContainer width="100%" height="80%">
                    <PieChart>
                      <Pie
                        data={healthStatus ? Object.entries(healthStatus.services).map(([name, service]) => ({
                          name: name.replace(/_/g, ' '),
                          value: service.latency_ms
                        })) : []}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                        label
                      >
                        {healthStatus && Object.entries(healthStatus.services).map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Performans Özeti
                  </Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Servis</TableCell>
                        <TableCell>Latency</TableCell>
                        <TableCell>Trend</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {healthStatus && Object.entries(healthStatus.services).map(([name, service]) => (
                        <TableRow key={name}>
                          <TableCell>{name.replace(/_/g, ' ')}</TableCell>
                          <TableCell>{service.latency_ms.toFixed(1)}ms</TableCell>
                          <TableCell>
                            {service.latency_ms < 50 ? (
                              <TrendingDownIcon color="success" />
                            ) : service.latency_ms > 200 ? (
                              <TrendingUpIcon color="error" />
                            ) : (
                              <TrendingUpIcon color="disabled" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Paper>
              </Grid>
            </Grid>
          )}
        </CardContent>
      </Card>

      {/* Service Details Dialog */}
      <Dialog
        open={!!selectedService}
        onClose={() => setSelectedService(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {selectedService?.replace(/_/g, ' ').toUpperCase()} - Detaylar
        </DialogTitle>
        <DialogContent>
          {selectedService && healthStatus?.services[selectedService] && (
            <Box>
              <Box sx={{ mb: 2 }}>
                <Chip
                  label={healthStatus.services[selectedService].status}
                  color={getStatusColor(healthStatus.services[selectedService].status) as 'success' | 'warning' | 'error' | 'default'}
                  sx={{ mr: 1 }}
                />
                <Chip
                  icon={<SpeedIcon />}
                  label={`${healthStatus.services[selectedService].latency_ms.toFixed(1)}ms`}
                  variant="outlined"
                />
              </Box>
              
              <Typography variant="subtitle2" gutterBottom>
                Ek Detaylar
              </Typography>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <pre style={{ margin: 0, overflow: 'auto' }}>
                  {JSON.stringify(healthStatus.services[selectedService].details, null, 2)}
                </pre>
              </Paper>

              <Typography variant="caption" color="textSecondary" sx={{ mt: 2, display: 'block' }}>
                Son kontrol: {new Date(healthStatus.services[selectedService].last_check).toLocaleString('tr-TR')}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedService(null)}>Kapat</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default HealthDashboard;
