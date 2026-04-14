import { useState, useEffect, useCallback } from 'react';
import { crmService } from '../../../services/crmService';

/**
 * Belge No uretim hook'u
 * Format: TF-YYYY-######
 * Ornek: TF-2026-000001, TF-2026-000042
 */
export const useBelgeNo = () => {
  const [belgeNo, setBelgeNo] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  const parseBelgeSequence = useCallback((value: string, year: number): number | null => {
    const match = /^TF-(\d{4})-(\d{6})$/.exec(value);
    if (!match) {
      return null;
    }
    if (Number(match[1]) !== year) {
      return null;
    }
    return Number(match[2]);
  }, []);

  const fetchNextSequence = useCallback(async (year: number): Promise<number> => {
    const quotes = await crmService.listQuotes();
    const maxSequence = quotes.reduce((max, quote) => {
      const candidates = [quote.documentNo, quote.quoteNumber].filter(
        (item): item is string => Boolean(item)
      );

      const quoteMax = candidates.reduce((acc, candidate) => {
        const parsed = parseBelgeSequence(candidate, year);
        return parsed !== null ? Math.max(acc, parsed) : acc;
      }, 0);

      return Math.max(max, quoteMax);
    }, 0);

    return maxSequence + 1;
  }, [parseBelgeSequence]);

  const generateBelgeNo = useCallback(async () => {
    setLoading(true);
    try {
      const year = new Date().getFullYear();
      const sequence = await fetchNextSequence(year);
      const formatted = `TF-${year}-${sequence.toString().padStart(6, '0')}`;
      setBelgeNo(formatted);
    } catch (error) {
      console.error('Belge No uretim hatasi:', error);
      const year = new Date().getFullYear();
      const timeBasedSequence = Number(new Date().toISOString().replace(/\D/g, '').slice(-6));
      const fallback = `TF-${year}-${timeBasedSequence.toString().padStart(6, '0')}`;
      setBelgeNo(fallback);
    } finally {
      setLoading(false);
    }
  }, [fetchNextSequence]);

  useEffect(() => {
    void generateBelgeNo();
  }, [generateBelgeNo]);

  return {
    belgeNo,
    loading,
    regenerate: generateBelgeNo,
  };
};
