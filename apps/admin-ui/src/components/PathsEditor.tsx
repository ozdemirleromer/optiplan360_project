import { useId, useState } from "react";

interface PathsEditorProps {
  paths: Record<string, string> | null;
  onSave: (paths: Record<string, string>) => Promise<void>;
  status: string;
}

export function PathsEditor({ paths, onSave, status }: PathsEditorProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  
  const fieldIds = {
    optiplanningExePath: useId(),
    optiplanningImportFolder: useId(),
    optiplanningExportFolder: useId(),
    optiplanningRulesFolder: useId(),
    machineDropFolder: useId(),
    tempFolder: useId(),
    xlsxTemplatePath: useId(),
  };

  const errorIds = {
    optiplanningExePath: `${fieldIds.optiplanningExePath}-error`,
    machineDropFolder: `${fieldIds.machineDropFolder}-error`,
  };

  const validateField = (name: string, value: string): string => {
    if (name === "machineDropFolder" && value && !value.startsWith("\\\\")) {
      return "UNC yolu \\\\ ile başlamalıdır";
    }
    if (name === "optiplanningExePath" && value && !value.endsWith(".exe")) {
      return ".exe dosyası olmalıdır";
    }
    return "";
  };

  const handleSave = async () => {
    if (!paths) return;
    
    const newErrors: Record<string, string> = {};
    Object.entries(paths).forEach(([key, value]) => {
      const error = validateField(key, value);
      if (error) newErrors[key] = error;
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSaving(true);
    try {
      await onSave(paths);
      setErrors({});
    } catch (error) {
      console.error("Save failed:", error);
      setErrors({ submit: "Kaydedilemedi" });
    } finally {
      setSaving(false);
    }
  };

  if (!paths) {
    return (
      <section className="panel" aria-labelledby="paths-heading">
        <h2 id="paths-heading">Paths Konfigürasyonu</h2>
        <p>Yükleniyor...</p>
      </section>
    );
  }

  return (
    <section className="panel" aria-labelledby="paths-heading">
      <h2 id="paths-heading">Paths Konfigürasyonu</h2>
      <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} aria-label="Paths form">
        <div className="field-wrap">
          <label htmlFor={fieldIds.optiplanningExePath}>
            OptiPlanning Exe Path
            <span aria-label="zorunlu alan">*</span>
          </label>
          <input
            id={fieldIds.optiplanningExePath}
            className="touch-target"
            type="text"
            value={paths.optiplanningExePath || ""}
            onChange={(e) => {
              paths.optiplanningExePath = e.target.value;
              setErrors({ ...errors, optiplanningExePath: "" });
            }}
            placeholder="C:/OptiPlanning/OptiPlanning.exe"
            aria-required="true"
            aria-invalid={!!errors.optiplanningExePath}
            aria-describedby={errors.optiplanningExePath ? errorIds.optiplanningExePath : undefined}
          />
          {errors.optiplanningExePath && (
            <div id={errorIds.optiplanningExePath} className="error-text" role="alert">
              {errors.optiplanningExePath}
            </div>
          )}
        </div>
        <div className="field-wrap">
          <label htmlFor={fieldIds.optiplanningImportFolder}>
            Import Klasörü
            <span aria-label="zorunlu alan">*</span>
          </label>
          <input
            id={fieldIds.optiplanningImportFolder}
            className="touch-target"
            type="text"
            value={paths.optiplanningImportFolder || ""}
            onChange={(e) => {
              paths.optiplanningImportFolder = e.target.value;
            }}
            placeholder="C:/OptiPlanning/import"
            aria-required="true"
          />
        </div>
        <div className="field-wrap">
          <label htmlFor={fieldIds.optiplanningExportFolder}>
            Export Klasörü
            <span aria-label="zorunlu alan">*</span>
          </label>
          <input
            id={fieldIds.optiplanningExportFolder}
            className="touch-target"
            type="text"
            value={paths.optiplanningExportFolder || ""}
            onChange={(e) => {
              paths.optiplanningExportFolder = e.target.value;
            }}
            placeholder="C:/OptiPlanning/export"
            aria-required="true"
          />
        </div>
        <div className="field-wrap">
          <label htmlFor={fieldIds.optiplanningRulesFolder}>Rules Klasörü</label>
          <input
            id={fieldIds.optiplanningRulesFolder}
            className="touch-target"
            type="text"
            value={paths.optiplanningRulesFolder || ""}
            onChange={(e) => {
              paths.optiplanningRulesFolder = e.target.value;
            }}
            placeholder="C:/OptiPlanning/rules"
          />
        </div>
        <div className="field-wrap">
          <label htmlFor={fieldIds.machineDropFolder}>
            Makine Drop Klasörü (UNC)
            <span aria-label="zorunlu alan">*</span>
          </label>
          <input
            id={fieldIds.machineDropFolder}
            className="touch-target"
            type="text"
            value={paths.machineDropFolder || ""}
            onChange={(e) => {
              paths.machineDropFolder = e.target.value;
              setErrors({ ...errors, machineDropFolder: "" });
            }}
            placeholder="\\\\MACHINE-SHARE\\opti-drop"
            aria-required="true"
            aria-invalid={!!errors.machineDropFolder}
            aria-describedby={errors.machineDropFolder ? errorIds.machineDropFolder : undefined}
          />
          {errors.machineDropFolder && (
            <div id={errorIds.machineDropFolder} className="error-text" role="alert">
              {errors.machineDropFolder}
            </div>
          )}
        </div>
        <div className="field-wrap">
          <label htmlFor={fieldIds.tempFolder}>Temp Klasörü</label>
          <input
            id={fieldIds.tempFolder}
            className="touch-target"
            type="text"
            value={paths.tempFolder || ""}
            onChange={(e) => {
              paths.tempFolder = e.target.value;
            }}
            placeholder="C:/OptiPlanning/temp"
          />
        </div>
        <div className="field-wrap">
          <label htmlFor={fieldIds.xlsxTemplatePath}>Excel Template Yolu</label>
        <input
          id={fieldIds.xlsxTemplatePath}
          className="touch-target"
          type="text"
          value={paths.xlsxTemplatePath || ""}
          onChange={(e) => {
            paths.xlsxTemplatePath = e.target.value;
          }}
          placeholder="./templates/Excel_sablon.xlsx"
        />
      </div>
      <div className="settings-actions">
        <button className="primary-btn touch-target" onClick={() => void handleSave()}>
          Kaydet
        </button>
      </div>
      </form>
      <p className="status-line">{status}</p>
    </section>
  );
}
