import { useEffect, useId, useState } from "react";
import { Icon } from "./Icon";
import { PathsEditor } from "./PathsEditor";
import { RulesEditor, type RulesConfig } from "./RulesEditor";

interface SettingsPanelProps {
  apiBase: string;
  onApiBaseChange: (value: string) => void;
  onHealthCheck: () => Promise<void>;
  onCustomerLookup: (phone: string) => Promise<void>;
}

const toRulesConfig = (rulesData: Record<string, unknown>): RulesConfig => ({
  cmToMmMultiplier: Number(rulesData["cm_to_mm_multiplier"] ?? rulesData["cmToMmMultiplier"] ?? 10),
  retryCountMax: Number(rulesData["retry_count_max"] ?? rulesData["retryCountMax"] ?? 3),
  optiModeDefault: (rulesData["opti_mode_default"] ?? rulesData["optiModeDefault"] ?? "C") as RulesConfig["optiModeDefault"],
});

export function SettingsPanel({ apiBase, onApiBaseChange, onHealthCheck, onCustomerLookup }: SettingsPanelProps) {
  const [phone, setPhone] = useState("05551234567");
  const [error, setError] = useState("");
  const [paths, setPaths] = useState<Record<string, string> | null>(null);
  const [rules, setRules] = useState<RulesConfig | null>(null);
  const [statusPaths, setStatusPaths] = useState("");
  const [statusRules, setStatusRules] = useState("");

  const apiBaseId = useId();
  const phoneId = useId();
  const errorId = useId();

  useEffect(() => {
    const loadConfigs = async () => {
      try {
        const pathsRes = await fetch(`${apiBase}/config/paths`);
        if (!pathsRes.ok) {
          throw new Error((await pathsRes.text()) || `HTTP ${pathsRes.status}`);
        }

        const pathsData = (await pathsRes.json()) as Record<string, string>;
        setPaths(pathsData);
        setStatusPaths("");
      } catch (err) {
        console.error("Paths load failed:", err);
        setStatusPaths(err instanceof Error ? err.message : "Paths yüklenemedi");
      }

      try {
        const rulesRes = await fetch(`${apiBase}/config/rules`);
        if (!rulesRes.ok) {
          throw new Error((await rulesRes.text()) || `HTTP ${rulesRes.status}`);
        }

        const rulesData = (await rulesRes.json()) as Record<string, unknown>;
        setRules(toRulesConfig(rulesData));
        setStatusRules("");
      } catch (err) {
        console.error("Rules load failed:", err);
        setStatusRules(err instanceof Error ? err.message : "Rules yüklenemedi");
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
      const response = await fetch(`${apiBase}/config/paths`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newPaths),
      });

      if (!response.ok) {
        throw new Error((await response.text()) || `HTTP ${response.status}`);
      }

      const savedPaths = (await response.json()) as Record<string, string>;
      setPaths(savedPaths);
      setStatusPaths("Paths kaydedildi.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Hata oluştu";
      setStatusPaths(message);
      throw err;
    }
  };

  const handleRulesSave = async (newRules: RulesConfig) => {
    setStatusRules("Kaydediliyor...");
    try {
      const response = await fetch(`${apiBase}/config/rules`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cm_to_mm_multiplier: newRules.cmToMmMultiplier,
          retry_count_max: newRules.retryCountMax,
          opti_mode_default: newRules.optiModeDefault,
        }),
      });

      if (!response.ok) {
        throw new Error((await response.text()) || `HTTP ${response.status}`);
      }

      const savedRules = toRulesConfig((await response.json()) as Record<string, unknown>);
      setRules(savedRules);
      setStatusRules("Rules kaydedildi.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Hata oluştu";
      setStatusRules(message);
      throw err;
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

      {!paths && statusPaths ? <p className="status-line">{statusPaths}</p> : null}
      {paths ? <PathsEditor paths={paths} onSave={handlePathsSave} status={statusPaths} /> : null}
      {!rules && statusRules ? <p className="status-line">{statusRules}</p> : null}
      {rules ? <RulesEditor {...rules} onSave={handleRulesSave} status={statusRules} /> : null}
    </>
  );
}
