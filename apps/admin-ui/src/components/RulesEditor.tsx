import { useId, useState } from "react";

interface RulesEditorProps {
  cmToMmMultiplier: number;
  retryCountMax: number;
  optiModeDefault: "A" | "B" | "C";
  onSave: (data: RulesEditorProps) => Promise<void>;
  status: string;
}

export function RulesEditor({ cmToMmMultiplier, retryCountMax, optiModeDefault, onSave, status }: RulesEditorProps) {
  const [cm, setCm] = useState(cmToMmMultiplier);
  const [retry, setRetry] = useState(retryCountMax);
  const [mode, setMode] = useState(optiModeDefault);

  const fieldIds = {
    cm: useId(),
    retry: useId(),
    mode: useId(),
  };

  const handleSave = async () => {
    try {
      await onSave({
        cmToMmMultiplier: cm,
        retryCountMax: retry,
        optiModeDefault: mode,
        onSave: () => Promise.resolve(),
        status: "",
      });
    } catch (error) {
      console.error("Save failed:", error);
    }
  };

  return (
    <section className="panel" aria-labelledby="rules-heading">
      <h2 id="rules-heading">Rules Konfigürasyonu</h2>
      <div className="field-wrap">
        <label htmlFor={fieldIds.cm}>CM → MM Çarpanı</label>
        <input
          id={fieldIds.cm}
          className="touch-target"
          type="number"
          value={cm}
          onChange={(e) => setCm(Number(e.target.value))}
          min="1"
          max="100"
        />
      </div>
      <div className="field-wrap">
        <label htmlFor={fieldIds.retry}>Maksimum Retry Sayısı</label>
        <input
          id={fieldIds.retry}
          className="touch-target"
          type="number"
          value={retry}
          onChange={(e) => setRetry(Number(e.target.value))}
          min="0"
          max="10"
        />
      </div>
      <div className="field-wrap">
        <label htmlFor={fieldIds.mode}>Default OptiPlanning Modu</label>
        <select id={fieldIds.mode} className="touch-target" value={mode} onChange={(e) => setMode(e.target.value as "A" | "B" | "C")}>
          <option value="A">Mode A (CLI)</option>
          <option value="B">Mode B (Excel COM)</option>
          <option value="C">Mode C (Operatör)</option>
        </select>
      </div>
      <div className="settings-actions">
        <button className="primary-btn touch-target" onClick={() => void handleSave()}>
          Kaydet
        </button>
      </div>
      <p className="status-line">{status}</p>
    </section>
  );
}
