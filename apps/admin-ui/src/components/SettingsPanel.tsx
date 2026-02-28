import { useEffect, useId, useState } from "react";
import { Icon } from "./Icon";
import { PathsEditor } from "./PathsEditor";
import { RulesEditor } from "./RulesEditor";

interface SettingsPanelProps {
  apiBase: string;
  onApiBaseChange: (value: string) => void;
  onHealthCheck: () => Promise<void>;
  onCustomerLookup: (phone: string) => Promise<void>;
}

export function SettingsPanel({ apiBase, onApiBaseChange, onHealthCheck, onCustomerLookup }: SettingsPanelProps) {
  const [phone, setPhone] = useState("05551234567");
  const [error, setError] = useState("");
  const [paths, setPaths] = useState<Record<string, string> | null>(null);
  const [rules, setRules] = useState<{ cmToMmMultiplier: number; retryCountMax: number; optiModeDefault: "A" | "B" | "C" } | null>(null);
  const [statusPaths, setStatusPaths] = useState("");
  const [statusRules, setStatusRules] = useState("");

  const apiBaseId = useId();
  const phoneId = useId();
  const errorId = useId();

  useEffect(() => {
    const loadConfigs = async () => {
      try {
        const pathsRes = await fetch(`${apiBase}/config/paths`);
        if (pathsRes.ok) {
          const pathsData = await pathsRes.json();
          setPaths(pathsData);
        }
      } catch (err) {
        console.error("Paths load failed:", err);
      }

      try {
        const rulesRes = await fetch(`${apiBase}/config/rules`);
        if (rulesRes.ok) {
          const rulesData = await rulesRes.json();
          setRules({
            cmToMmMultiplier: rulesData.cm_to_mm_multiplier,
            retryCountMax: rulesData.retry_count_max,
            optiModeDefault: rulesData.opti_mode_default,
          });
        }
      } catch (err) {
        console.error("Rules load failed:", err);
      }
    };

    void loadConfigs();
  }, [apiBase]);

  const handleLookup = async () => {
    if (!phone.trim()) {
      setError("Telefon alanı zorunludur.");
      return;
    }
    setError("");
    await onCustomerLookup(phone);
  };

  const handlePathsSave = async (newPaths: Record<string, string>) => {
    setStatusPaths("Kaydediliyor...");
    try {
      // Note: This would require a POST /config/paths endpoint on backend
      setStatusPaths("Paths kaydedildi (API implement gerekli)");
      setPaths(newPaths);
    } catch (err) {
      setStatusPaths(err instanceof Error ? err.message : "Hata oluştu");
    }
  };

  const handleRulesSave = async (newRules: Omit<RulesEditor, "onSave" | "status">) => {
    setStatusRules("Kaydediliyor...");
    try {
      // Note: This would require a POST /config/rules endpoint on backend
      setStatusRules("Rules kaydedildi (API implement gerekli)");
      setRules({
        cmToMmMultiplier: newRules.cmToMmMultiplier,
        retryCountMax: newRules.retryCountMax,
        optiModeDefault: newRules.optiModeDefault,
      });
    } catch (err) {
      setStatusRules(err instanceof Error ? err.message : "Hata oluştu");
    }
  };

  return (
    <>
      <section className="panel" aria-labelledby="settings-heading">
        <h2 id="settings-heading">Test & Ayarlar</h2>
        <div className="field-wrap">
          <label htmlFor={apiBaseId}>API Base URL</label>
          <input
            id={apiBaseId}
            className="touch-target"
            required
            value={apiBase}
            onChange={(event) => onApiBaseChange(event.target.value)}
            placeholder="http://127.0.0.1:8090"
          />
        </div>

        <div className="field-wrap">
          <label htmlFor={phoneId}>CRM Lookup Telefonu</label>
          <input
            id={phoneId}
            className="touch-target"
            required
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
          />
          {error ? (
            <p id={errorId} className="field-error">
              {error}
            </p>
          ) : null}
        </div>

        <div className="settings-actions">
          <button className="primary-btn touch-target" onClick={() => void onHealthCheck()}>
            <Icon name="shield" label="Health check" size={16} />
            <span>Health Test</span>
          </button>
          <button className="primary-btn touch-target" onClick={() => void handleLookup()}>
            <Icon name="search" label="Customer lookup" size={16} />
            <span>Lookup Test</span>
          </button>
        </div>
      </section>

      {paths ? <PathsEditor paths={paths} onSave={handlePathsSave} status={statusPaths} /> : null}
      {rules ? <RulesEditor {...rules} onSave={handleRulesSave} status={statusRules} /> : null}
    </>
  );
}

interface RulesEditor {
  cmToMmMultiplier: number;
  retryCountMax: number;
  optiModeDefault: "A" | "B" | "C";
  onSave: (data: RulesEditor) => Promise<void>;
  status: string;
}
