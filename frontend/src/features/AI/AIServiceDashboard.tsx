/**
 * OptiPlan 360 - AI Service Dashboard Component
 * AI/ML servisleri için ana dashboard ve kontrol paneli
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  TextField,
  Button,
  Grid,
  Chip,
  LinearProgress,
  Alert,
  IconButton,
  Tabs,
  Tab,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  CircularProgress
} from '@mui/material';
import {
  Psychology as AIIcon,
  Image as ImageIcon,
  TextFields as TextIcon,
  Brush as BrushIcon,
  School as MetaIcon,
  Refresh as RefreshIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Send as SendIcon
} from '@mui/icons-material';
import { aiService, integrationService, type HealthStatus } from '../../services/aiIntegrationService';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`ai-tabpanel-${index}`}
      aria-labelledby={`ai-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

// Service Status Indicator Component
const ServiceStatusIndicator: React.FC<{
  name: string;
  status: string;
  latency?: number;
}> = ({ name, status, latency }) => {
  const getIcon = () => {
    switch (status) {
      case 'healthy':
        return <SuccessIcon color="success" />;
      case 'degraded':
        return <WarningIcon color="warning" />;
      case 'unhealthy':
        return <ErrorIcon color="error" />;
      default:
        return <ErrorIcon color="disabled" />;
    }
  };

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
    <ListItem>
      <ListItemIcon>{getIcon()}</ListItemIcon>
      <ListItemText
        primary={name}
        secondary={latency ? `${latency.toFixed(1)} ms` : undefined}
      />
      <Chip
        label={status}
        color={getColor() as 'success' | 'warning' | 'error' | 'default'}
        size="small"
      />
    </ListItem>
  );
};

// AI Service Dashboard Component
export const AIServiceDashboard: React.FC = () => {
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // LLM State
  const [llmPrompt, setLlmPrompt] = useState('');
  const [llmResponse, setLlmResponse] = useState('');
  const [llmLoading, setLlmLoading] = useState(false);

  // Vision State
  const [imagePath, setImagePath] = useState('');
  const [classificationResults, setClassificationResults] = useState<{ label: string; score: number }[]>([]);
  const [visionLoading, setVisionLoading] = useState(false);

  // Diffusion State
  const [diffusionPrompt, setDiffusionPrompt] = useState('');
  const [diffusionLoading, setDiffusionLoading] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);

  // Fetch health status
  const fetchHealthStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const status = await integrationService.getHealthStatus();
      setHealthStatus(status);
    } catch (err) {
      setError('Sağlık durumu alınamadı');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealthStatus();
    const interval = setInterval(fetchHealthStatus, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, [fetchHealthStatus]);

  // LLM Generate
  const handleLLMGenerate = async () => {
    if (!llmPrompt.trim()) return;
    setLlmLoading(true);
    setError(null);
    try {
      const response = await aiService.generateText({
        prompt: llmPrompt,
        max_tokens: 256,
        temperature: 0.7
      });
      setLlmResponse(response.response);
    } catch (err) {
      setError('LLM yanıtı alınamadı');
      console.error(err);
    } finally {
      setLlmLoading(false);
    }
  };

  // Vision Classify
  const handleVisionClassify = async () => {
    if (!imagePath.trim()) return;
    setVisionLoading(true);
    setError(null);
    try {
      const results = await aiService.classifyImage({
        image_path: imagePath,
        top_k: 5
      });
      setClassificationResults(results);
    } catch (err) {
      setError('Görüntü sınıflandırılamadı');
      console.error(err);
    } finally {
      setVisionLoading(false);
    }
  };

  // Diffusion Generate
  const handleDiffusionGenerate = async () => {
    if (!diffusionPrompt.trim()) return;
    setDiffusionLoading(true);
    setError(null);
    try {
      const result = await aiService.generateImage({
        prompt: diffusionPrompt,
        num_images: 1
      });
      setGeneratedImages(result.paths || []);
    } catch (err) {
      setError('Görüntü üretilemedi');
      console.error(err);
    } finally {
      setDiffusionLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" gutterBottom>
        <AIIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        AI/ML Service Dashboard
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Health Status Card */}
      <Card sx={{ mb: 3 }}>
        <CardHeader
          title="Servis Sağlık Durumu"
          action={
            <IconButton onClick={fetchHealthStatus} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          }
        />
        <CardContent>
          {loading && <LinearProgress />}
          {healthStatus && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Chip
                  label={healthStatus.status.toUpperCase()}
                  color={
                    healthStatus.status === 'healthy'
                      ? 'success'
                      : healthStatus.status === 'degraded'
                      ? 'warning'
                      : 'error'
                  }
                  sx={{ mr: 2 }}
                />
                <Typography variant="body2" color="textSecondary">
                  Son güncelleme: {new Date(healthStatus.timestamp).toLocaleString('tr-TR')}
                </Typography>
              </Box>
              
              <Paper variant="outlined">
                <List dense>
                  {Object.entries(healthStatus.services).map(([name, service]) => (
                    <ServiceStatusIndicator
                      key={name}
                      name={name}
                      status={service.status}
                      latency={service.latency_ms}
                    />
                  ))}
                </List>
              </Paper>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* AI Services Tabs */}
      <Card>
        <CardHeader title="AI/ML Tools" />
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab icon={<TextIcon />} label="LLM" />
          <Tab icon={<ImageIcon />} label="Vision" />
          <Tab icon={<BrushIcon />} label="Diffusion" />
          <Tab icon={<MetaIcon />} label="Meta-Learning" />
        </Tabs>

        {/* LLM Tab */}
        <TabPanel value={activeTab} index={0}>
          <Typography variant="h6" gutterBottom>
            Text Generation
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Prompt"
            value={llmPrompt}
            onChange={(e) => setLlmPrompt(e.target.value)}
            placeholder="Bir metin girin..."
            sx={{ mb: 2 }}
          />
          <Button
            variant="contained"
            onClick={handleLLMGenerate}
            disabled={llmLoading || !llmPrompt.trim()}
            startIcon={llmLoading ? <CircularProgress size={20} /> : <SendIcon />}
          >
            Generate
          </Button>
          {llmResponse && (
            <Paper sx={{ mt: 2, p: 2, bgcolor: 'grey.50' }}>
              <Typography variant="body1">{llmResponse}</Typography>
            </Paper>
          )}
        </TabPanel>

        {/* Vision Tab */}
        <TabPanel value={activeTab} index={1}>
          <Typography variant="h6" gutterBottom>
            Image Classification
          </Typography>
          <TextField
            fullWidth
            label="Image Path"
            value={imagePath}
            onChange={(e) => setImagePath(e.target.value)}
            placeholder="/uploads/image.jpg"
            sx={{ mb: 2 }}
          />
          <Button
            variant="contained"
            onClick={handleVisionClassify}
            disabled={visionLoading || !imagePath.trim()}
            startIcon={visionLoading ? <CircularProgress size={20} /> : <ImageIcon />}
          >
            Classify
          </Button>
          {classificationResults.length > 0 && (
            <Paper sx={{ mt: 2 }}>
              <List>
                {classificationResults.map((result, idx) => (
                  <ListItem key={idx}>
                    <ListItemText
                      primary={result.label}
                      secondary={`${(result.score * 100).toFixed(1)}%`}
                    />
                    <LinearProgress
                      variant="determinate"
                      value={result.score * 100}
                      sx={{ width: 100, ml: 2 }}
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
          )}
        </TabPanel>

        {/* Diffusion Tab */}
        <TabPanel value={activeTab} index={2}>
          <Typography variant="h6" gutterBottom>
            Image Generation
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Prompt"
            value={diffusionPrompt}
            onChange={(e) => setDiffusionPrompt(e.target.value)}
            placeholder="Bir görsel açıklaması girin..."
            sx={{ mb: 2 }}
          />
          <Button
            variant="contained"
            onClick={handleDiffusionGenerate}
            disabled={diffusionLoading || !diffusionPrompt.trim()}
            startIcon={diffusionLoading ? <CircularProgress size={20} /> : <BrushIcon />}
          >
            Generate Image
          </Button>
          {generatedImages.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Generated Images:
              </Typography>
              <Grid container spacing={2}>
                {generatedImages.map((path, idx) => (
                  <Grid item xs={12} sm={6} md={4} key={idx}>
                    <Paper
                      sx={{
                        p: 2,
                        textAlign: 'center',
                        bgcolor: 'grey.100'
                      }}
                    >
                      <Typography variant="caption" display="block" noWrap>
                        {path}
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
        </TabPanel>

        {/* Meta-Learning Tab */}
        <TabPanel value={activeTab} index={3}>
          <Typography variant="h6" gutterBottom>
            Few-Shot Learning
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            Few-shot learning allows the model to learn from a small number of examples.
            Provide support images and labels, then query with a new image.
          </Alert>
          <Typography variant="body2" color="textSecondary">
            Bu özellik için API entegrasyonu tamamlandı. Gelişmiş kullanım için Few-Shot Learning API'sini kullanın.
          </Typography>
        </TabPanel>
      </Card>
    </Box>
  );
};

export default AIServiceDashboard;
