/**
 * OptiPlan 360 - Export Progress Component
 * Atomic transaction ve export progress UI
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  LinearProgress,
  Stepper,
  Step,
  StepLabel,
  Button,
  Alert,
  Chip,
  IconButton,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Grid,
  CircularProgress
} from '@mui/material';
import {
  Download as DownloadIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  HourglassEmpty as PendingIcon,
  Refresh as RefreshIcon,
  Cancel as CancelIcon,
  VerifiedUser as VerifiedIcon
} from '@mui/icons-material';

// Types
export interface ExportTransaction {
  id: string;
  islem_id: string;
  status: 'pending' | 'in_progress' | 'writing' | 'validating' | 'committing' | 'completed' | 'failed' | 'rolled_back';
  progress: number;
  filename: string;
  recordCount: number;
  currentPhase: string;
  checksum?: string;
  errorMessage?: string;
  tempPath?: string;
  finalPath?: string;
  startedAt: string;
  completedAt?: string;
  bantValidations: { row: number; valid: boolean; errors: string[] }[];
}

interface ExportProgressProps {
  transaction?: ExportTransaction;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

// Status helpers
const getStatusColor = (status: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
  switch (status) {
    case 'completed':
      return 'success';
    case 'failed':
    case 'rolled_back':
      return 'error';
    case 'in_progress':
    case 'writing':
    case 'validating':
    case 'committing':
      return 'primary';
    case 'pending':
      return 'warning';
    default:
      return 'default';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'completed':
      return <SuccessIcon color="success" />;
    case 'failed':
    case 'rolled_back':
      return <ErrorIcon color="error" />;
    case 'in_progress':
    case 'writing':
    case 'validating':
    case 'committing':
      return <CircularProgress size={20} />;
    case 'pending':
      return <PendingIcon color="warning" />;
    default:
      return <PendingIcon />;
  }
};

const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    'pending': 'Bekliyor',
    'in_progress': 'Devam Ediyor',
    'writing': 'Dosya Yazılıyor',
    'validating': 'Validasyon',
    'committing': 'Commit Ediliyor',
    'completed': 'Tamamlandı',
    'failed': 'Hata',
    'rolled_back': 'Rollback'
  };
  return labels[status] || status;
};

// Export Steps
const EXPORT_STEPS = [
  'Başlatma',
  'Kilitleme',
  'Validasyon',
  'Yazma',
  'Checkpoint',
  'Commit'
];

export const ExportProgress: React.FC<ExportProgressProps> = ({
  transaction,
  onComplete: _onComplete,
  onError
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Poll for updates if transaction is in progress
  useEffect(() => {
    if (!transaction) return;
    
    const inProgressStatuses = ['pending', 'in_progress', 'writing', 'validating', 'committing'];
    if (!inProgressStatuses.includes(transaction.status)) return;

    const interval = setInterval(() => {
      // In real implementation, this would fetch updated status
    }, 2000);

    return () => clearInterval(interval);
  }, [transaction]);

  const handleCancel = async () => {
    if (!transaction) return;
    setIsCancelling(true);
    try {
      // In real implementation, call rollback API
      // await integrationService.rollbackExport(transaction.id);
    } catch {
      onError?.('Rollback işlemi başarısız');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleDownload = () => {
    if (transaction?.finalPath) {
      window.open(transaction.finalPath, '_blank');
    }
  };

  if (!transaction) {
    return (
      <Card>
        <CardContent>
          <Typography color="textSecondary" align="center">
            Aktif export işlemi yok
          </Typography>
        </CardContent>
      </Card>
    );
  }

  // Determine current step index
  const getCurrentStep = () => {
    switch (transaction.status) {
      case 'pending':
        return 0;
      case 'in_progress':
        return 1;
      case 'writing':
        return 3;
      case 'validating':
        return 2;
      case 'committing':
        return 4;
      case 'completed':
        return 5;
      case 'failed':
      case 'rolled_back':
        return -1;
      default:
        return 0;
    }
  };

  const currentStep = getCurrentStep();
  const isFailed = transaction.status === 'failed' || transaction.status === 'rolled_back';
  const isCompleted = transaction.status === 'completed';
  const isActive = !isFailed && !isCompleted;

  return (
    <Card>
      <CardHeader
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6">
              Export Progress
            </Typography>
            <Chip
              icon={getStatusIcon(transaction.status)}
              label={getStatusLabel(transaction.status)}
              color={getStatusColor(transaction.status)}
              size="small"
            />
          </Box>
        }
        action={
          <Box sx={{ display: 'flex', gap: 1 }}>
            {isCompleted && (
              <Tooltip title="İndir">
                <IconButton onClick={handleDownload} color="primary">
                  <DownloadIcon />
                </IconButton>
              </Tooltip>
            )}
            {isActive && (
              <Tooltip title="İptal Et">
                <IconButton 
                  onClick={handleCancel} 
                  color="error"
                  disabled={isCancelling}
                >
                  <CancelIcon />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Detaylar">
              <IconButton onClick={() => setShowDetails(true)}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        }
      />
      <CardContent>
        {/* Progress Info */}
        <Box sx={{ mb: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="textSecondary">
                İşlem ID
              </Typography>
              <Typography variant="body1" fontFamily="monospace">
                {transaction.islem_id}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="textSecondary">
                Dosya
              </Typography>
              <Typography variant="body1" noWrap>
                {transaction.filename}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="textSecondary">
                Kayıt Sayısı
              </Typography>
              <Typography variant="body1">
                {transaction.recordCount.toLocaleString('tr-TR')}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="textSecondary">
                Başlangıç
              </Typography>
              <Typography variant="body1">
                {new Date(transaction.startedAt).toLocaleString('tr-TR')}
              </Typography>
            </Grid>
          </Grid>
        </Box>

        {/* Progress Bar */}
        {isActive && (
          <Box sx={{ mb: 3 }}>
            <LinearProgress
              variant="determinate"
              value={transaction.progress}
              sx={{ height: 8, borderRadius: 4 }}
            />
            <Typography variant="body2" align="right" sx={{ mt: 0.5 }}>
              {transaction.progress}%
            </Typography>
          </Box>
        )}

        {/* Stepper */}
        <Stepper activeStep={currentStep} alternativeLabel>
          {EXPORT_STEPS.map((label, index) => (
            <Step key={label} completed={index < currentStep}>
              <StepLabel
                error={isFailed && index === currentStep}
                optional={
                  index === currentStep && isActive ? (
                    <Typography variant="caption">{transaction.currentPhase}</Typography>
                  ) : undefined
                }
              >
                {label}
              </StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* Error Message */}
        {isFailed && transaction.errorMessage && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {transaction.errorMessage}
          </Alert>
        )}

        {/* Success Message */}
        {isCompleted && (
          <Alert severity="success" sx={{ mt: 2 }} icon={<VerifiedIcon />}>
            Export başarıyla tamamlandı. Dosya indirilmeye hazır.
          </Alert>
        )}

        {/* Bant Validations */}
        {transaction.bantValidations.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Bant Validasyonları
            </Typography>
            <Paper variant="outlined">
              <List dense>
                {transaction.bantValidations.slice(0, 5).map((validation) => (
                  <ListItem key={validation.row}>
                    <ListItemIcon>
                      {validation.valid ? (
                        <SuccessIcon color="success" fontSize="small" />
                      ) : (
                        <ErrorIcon color="error" fontSize="small" />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={`Satır ${validation.row + 1}`}
                      secondary={validation.errors.join(', ')}
                      secondaryTypographyProps={{
                        color: validation.valid ? 'textSecondary' : 'error'
                      }}
                    />
                  </ListItem>
                ))}
                {transaction.bantValidations.length > 5 && (
                  <ListItem>
                    <ListItemText
                      secondary={`... ve ${transaction.bantValidations.length - 5} diğer`}
                    />
                  </ListItem>
                )}
              </List>
            </Paper>
          </Box>
        )}

        {/* Checksum */}
        {transaction.checksum && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="textSecondary" fontFamily="monospace">
              Checksum: {transaction.checksum.substring(0, 16)}...
            </Typography>
          </Box>
        )}
      </CardContent>

      {/* Details Dialog */}
      <Dialog
        open={showDetails}
        onClose={() => setShowDetails(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Export Transaction Details</DialogTitle>
        <DialogContent>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Property</TableCell>
                <TableCell>Value</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>Transaction ID</TableCell>
                <TableCell>{transaction.id}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>İşlem ID</TableCell>
                <TableCell>{transaction.islem_id}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Status</TableCell>
                <TableCell>
                  <Chip
                    label={getStatusLabel(transaction.status)}
                    color={getStatusColor(transaction.status)}
                    size="small"
                  />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Dosya Adı</TableCell>
                <TableCell>{transaction.filename}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Kayıt Sayısı</TableCell>
                <TableCell>{transaction.recordCount}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>İlerleme</TableCell>
                <TableCell>{transaction.progress}%</TableCell>
              </TableRow>
              {transaction.tempPath && (
                <TableRow>
                  <TableCell>Geçici Yol</TableCell>
                  <TableCell fontFamily="monospace">{transaction.tempPath}</TableCell>
                </TableRow>
              )}
              {transaction.finalPath && (
                <TableRow>
                  <TableCell>Son Yol</TableCell>
                  <TableCell fontFamily="monospace">{transaction.finalPath}</TableCell>
                </TableRow>
              )}
              <TableRow>
                <TableCell>Başlangıç</TableCell>
                <TableCell>{new Date(transaction.startedAt).toLocaleString('tr-TR')}</TableCell>
              </TableRow>
              {transaction.completedAt && (
                <TableRow>
                  <TableCell>Bitiş</TableCell>
                  <TableCell>{new Date(transaction.completedAt).toLocaleString('tr-TR')}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDetails(false)}>Kapat</Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

// Export List Component
export const ExportList: React.FC<{
  exports: ExportTransaction[];
  onRefresh: () => void;
}> = ({ exports, onRefresh }) => {
  return (
    <Card>
      <CardHeader
        title="Recent Exports"
        action={
          <IconButton onClick={onRefresh}>
            <RefreshIcon />
          </IconButton>
        }
      />
      <CardContent>
        {exports.length === 0 ? (
          <Typography color="textSecondary" align="center">
            Henüz export işlemi yok
          </Typography>
        ) : (
          <List>
            {exports.map((exportItem) => (
              <ListItem
                key={exportItem.id}
                divider
                secondaryAction={
                  <Chip
                    icon={getStatusIcon(exportItem.status)}
                    label={getStatusLabel(exportItem.status)}
                    color={getStatusColor(exportItem.status)}
                    size="small"
                  />
                }
              >
                <ListItemText
                  primary={exportItem.filename}
                  secondary={`${exportItem.recordCount} records • ${new Date(exportItem.startedAt).toLocaleString('tr-TR')}`}
                />
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
};

export default ExportProgress;
