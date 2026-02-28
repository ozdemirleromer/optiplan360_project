import { useState } from "react";
import { adminService } from "../../services/adminService";

type TestState = "idle" | "running" | "success" | "error";
type SaveState = "idle" | "saving" | "success" | "error";

export function IntegrationsPage() {
  const [testState, setTestState] = useState<TestState>("idle");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [statusMessage, setStatusMessage] = useState<string>("");

  const handleTestOcrServices = async () => {
    setTestState("running");
    setStatusMessage("");

    const results = await Promise.allSettled([
      adminService.testAzureOCR(),
      adminService.testGoogle(),
      adminService.testAws(),
    ]);

    const hasFailure = results.some((result) => result.status === "rejected");
    setTestState(hasFailure ? "error" : "success");
    setStatusMessage(
      hasFailure
        ? "Bazı OCR servisleri test edilemedi."
        : "OCR servis testleri başarılı."
    );
  };

  const handleSaveOcrConfig = async () => {
    setSaveState("saving");
    setStatusMessage("");

    try {
      await adminService.updateOCRConfig({
        engine: "tesseract",
        languages: ["tur", "eng"],
        preprocessing_enabled: true,
        confidence_threshold: 0.7,
      });
      setSaveState("success");
      setStatusMessage("OCR yapılandırması kaydedildi.");
    } catch {
      setSaveState("error");
      setStatusMessage("OCR yapılandırması kaydedilemedi.");
    }
  };

  return (
    <section style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>Integrations</h2>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={handleTestOcrServices}
          disabled={testState === "running"}
        >
          OCR Servislerini Test Et
        </button>

        <button
          type="button"
          onClick={handleSaveOcrConfig}
          disabled={saveState === "saving"}
        >
          OCR Yapılandırmayı Kaydet
        </button>
      </div>

      {statusMessage ? (
        <p role="status" style={{ marginTop: 12 }}>
          {statusMessage}
        </p>
      ) : null}
    </section>
  );
}

export default IntegrationsPage;
