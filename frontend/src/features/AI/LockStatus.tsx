/**
 * OptiPlan 360 - Lock Status Component
 * Distributed lock status ve yönetim UI
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Chip,
  IconButton,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  LinearProgress,
  Grid,
  Badge
} from '@mui/material';
import {
  Lock as LockIcon,
  LockOpen as UnlockIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  Warning as WarningIcon,
  Timer as TimerIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { integrationService } from '../../services/aiIntegrationService';

// Types
export interface LockInfo {
  lock_id: string;
  resource_id: string;
  lock_type: 'EXPORT' | 'EDIT' | 'DELETE' | 'SYSTEM';
  owner: string;
  acquired_at: string;
  expires_at: string;
  remaining_seconds: number;
}

export interface LockStats {
  total_locks: number;
  active_locks: number;
  by_type: Record<string, number>;
  expired: number;
}

interface LockStatusProps {
  showAdminControls?: boolean;
}

// Lock type helpers
const getLockTypeColor = (type: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
  switch (type) {
    case 'EXPORT':
      return 'primary';
    case 'EDIT':
      return 'info';
    case 'DELETE':
      return 'error';
    case 'SYSTEM':
      return 'secondary';
    default:
      return 'default';
  }
};

const getLockTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    'EXPORT': 'Export',
    'EDIT': 'Düzenleme',
    'DELETE': 'Silme',
    'SYSTEM': 'Sistem'
  };
  return labels[type] || type;
};

// Format remaining time
const formatRemainingTime = (seconds: number): string => {
  if (seconds <= 0) return 'Süre doldu';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}dk`;
  return `${Math.floor(seconds / 3600)}s ${Math.floor((seconds % 3600) / 60)}dk`;
};

export const LockStatus: React.FC<LockStatusProps> = ({ showAdminControls = false }) => {
  const [locks, setLocks] = useState<LockInfo[]>([]);
  const [stats, setStats] = useState<LockStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReleaseDialog, setShowReleaseDialog] = useState(false);
  const [selectedLock, setSelectedLock] = useState<LockInfo | null>(null);
  const [releaseOwner, setReleaseOwner] = useState('');

  // Fetch lock stats
  const fetchLockStats = useCallback(async () => {
    try {
      const data = await integrationService.getLockStats();
      setStats(data);
    } catch (err) {
      console.error('Lock stats error:', err);
    }
  }, []);

  // Fetch locks (simulated - in real implementation, this would be an API call)
  const fetchLocks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // In real implementation, this would fetch from API
      // const data = await integrationService.getActiveLocks();
      // setLocks(data);
      
      // For now, simulate with empty array
      setLocks([]);
      await fetchLockStats();
    } catch {
      setError('Kilit durumu alınamadı');
    } finally {
      setLoading(false);
    }
  }, [fetchLockStats]);

  useEffect(() => {
    fetchLocks();
    const interval = setInterval(fetchLocks, 10000); // Every 10 seconds
    return () => clearInterval(interval);
  }, [fetchLocks]);

  // Countdown timer for lock expiration
  useEffect(() => {
    if (locks.length === 0) return;
    
    const interval = setInterval(() => {
      setLocks(prevLocks =>
        prevLocks.map(lock => ({
          ...lock,
          remaining_seconds: Math.max(0, lock.remaining_seconds - 1)
        }))
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [locks.length]);

  const handleReleaseLock = async () => {
    if (!selectedLock && !releaseOwner) return;
    
    try {
      if (selectedLock) {
        // Release specific lock
        // await integrationService.releaseLock(selectedLock.lock_id);
      } else if (releaseOwner) {
        // Release all locks for owner
        const result = await integrationService.releaseOwnerLocks(releaseOwner);
        setError(null);
        alert(`${result.released} kilit serbest bırakıldı`);
      }
      
      setShowReleaseDialog(false);
      setSelectedLock(null);
      setReleaseOwner('');
      fetchLocks();
    } catch {
      setError('Kilit serbest bırakılamadı');
    }
  };

  const handleCleanupExpired = async () => {
    try {
      const result = await integrationService.cleanupExpiredLocks();
      setError(null);
      fetchLocks();
      alert(`${result.cleaned} süresi dolmuş kilit temizlendi`);
    } catch {
      setError('Temizlik işlemi başarısız');
    }
  };

  const openReleaseDialog = (lock?: LockInfo) => {
    setSelectedLock(lock || null);
    setReleaseOwner(lock?.owner || '');
    setShowReleaseDialog(true);
  };

  return (
    <Card>
      <CardHeader
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6">Lock Status</Typography>
            {stats && (
              <Badge badgeContent={stats.active_locks} color="primary">
                <LockIcon />
              </Badge>
            )}
          </Box>
        }
        action={
          <Box sx={{ display: 'flex', gap: 1 }}>
            {showAdminControls && (
              <Button
                size="small"
                variant="outlined"
                color="error"
                onClick={handleCleanupExpired}
                startIcon={<DeleteIcon />}
              >
                Temizle
              </Button>
            )}
            <IconButton onClick={fetchLocks} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Box>
        }
      />
      <CardContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {loading && <LinearProgress sx={{ mb: 2 }} />}

        {/* Stats Overview */}
        {stats && (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="primary">
                  {stats.active_locks}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Aktif Kilit
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4">
                  {stats.total_locks}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Toplam Kilit
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="error">
                  {stats.expired}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Süresi Dolmuş
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4">
                  {Object.keys(stats.by_type).length}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Kilit Tipi
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        )}

        {/* Lock Type Distribution */}
        {stats && stats.by_type && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Kilit Tipi Dağılımı
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {Object.entries(stats.by_type).map(([type, count]) => (
                <Chip
                  key={type}
                  label={`${getLockTypeLabel(type)}: ${count}`}
                  color={getLockTypeColor(type)}
                  size="small"
                  icon={<LockIcon />}
                />
              ))}
            </Box>
          </Box>
        )}

        {/* Active Locks Table */}
        <Typography variant="subtitle2" gutterBottom>
          Aktif Kilitler
        </Typography>
        
        {locks.length === 0 ? (
          <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'grey.50' }}>
            <LockOpenIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
            <Typography color="textSecondary">
              Aktif kilit yok
            </Typography>
          </Paper>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Tip</TableCell>
                  <TableCell>Kaynak</TableCell>
                  <TableCell>Sahip</TableCell>
                  <TableCell>Kalan Süre</TableCell>
                  {showAdminControls && <TableCell>İşlem</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {locks.map((lock) => (
                  <TableRow
                    key={lock.lock_id}
                    sx={{
                      bgcolor: lock.remaining_seconds < 60 ? 'warning.50' : 'inherit'
                    }}
                  >
                    <TableCell>
                      <Chip
                        label={getLockTypeLabel(lock.lock_type)}
                        color={getLockTypeColor(lock.lock_type)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {lock.resource_id}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <PersonIcon fontSize="small" color="action" />
                        {lock.owner}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <TimerIcon
                          fontSize="small"
                          color={lock.remaining_seconds < 60 ? 'warning' : 'action'}
                        />
                        <Typography
                          color={lock.remaining_seconds < 60 ? 'warning.main' : 'textPrimary'}
                        >
                          {formatRemainingTime(lock.remaining_seconds)}
                        </Typography>
                      </Box>
                    </TableCell>
                    {showAdminControls && (
                      <TableCell>
                        <Tooltip title="Kilidi Serbest Bırak">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => openReleaseDialog(lock)}
                          >
                            <UnlockIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Warnings */}
        {stats && stats.expired > 0 && (
          <Alert severity="warning" sx={{ mt: 2 }} icon={<WarningIcon />}>
            {stats.expired} adet süresi dolmuş kilit var. Temizlik önerilir.
          </Alert>
        )}
      </CardContent>

      {/* Release Lock Dialog */}
      <Dialog
        open={showReleaseDialog}
        onClose={() => setShowReleaseDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {selectedLock ? 'Kilidi Serbest Bırak' : 'Tüm Kilitleri Serbest Bırak'}
        </DialogTitle>
        <DialogContent>
          {selectedLock ? (
            <Typography>
              <strong>{selectedLock.resource_id}</strong> kaynağındaki kilidi serbest bırakmak istediğinize emin misiniz?
            </Typography>
          ) : (
            <>
              <Typography gutterBottom>
                Bir kullanıcının tüm kilitlerini serbest bırakmak için kullanıcı ID'si girin:
              </Typography>
              <TextField
                fullWidth
                label="Kullanıcı ID"
                value={releaseOwner}
                onChange={(e) => setReleaseOwner(e.target.value)}
                placeholder="user-001"
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowReleaseDialog(false)}>İptal</Button>
          <Button
            onClick={handleReleaseLock}
            color="error"
            variant="contained"
            disabled={!selectedLock && !releaseOwner}
          >
            Serbest Bırak
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

// Table Container helper
const TableContainer: React.FC<{ component: typeof Paper; variant: string; children: React.ReactNode }> = ({
  component: Component,
  variant,
  children
}) => {
  return (
    <Component variant={variant as 'outlined' | 'elevation'}>
      {children}
    </Component>
  );
};

export default LockStatus;
