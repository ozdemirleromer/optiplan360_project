import { useEffect, useState } from "react";

import { getAuthToken } from "../../services/apiClient";
import type { WorkflowRecord } from "../../services/optiplanWorkflowService";

export function usePhase2ImageAsset(records: WorkflowRecord[], activeUuid: string | null) {
  const [imageLoadError, setImageLoadError] = useState(false);
  const [imageObjectUrl, setImageObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    const imageUrl = records.find((record) => record.kayitUuid === activeUuid)?.imageUrl;

    setImageObjectUrl(null);
    setImageLoadError(false);

    const authToken = getAuthToken();
    if (!imageUrl || !authToken) {
      setImageLoadError(Boolean(imageUrl) && !authToken);
      return () => undefined;
    }

    void fetch(imageUrl, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const blob = await response.blob();
        if (!blob.type.startsWith("image/")) {
          throw new Error("UNSUPPORTED_IMAGE_RESPONSE");
        }

        return blob;
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          objectUrl = null;
          return;
        }
        setImageObjectUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) {
          setImageLoadError(true);
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [activeUuid, records]);

  return {
    imageLoadError,
    imageObjectUrl,
    setImageLoadError,
    setImageObjectUrl,
  };
}
