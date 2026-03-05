import React, { useState } from "react";
import "./metadata.css";

export interface MetaDataValues {
  customerCode: string;
  businessName: string;
  taxNo: string;
  address: string;
}

interface MetaDataEntryProps {
  values: MetaDataValues;
  onChange: (values: MetaDataValues) => void;
  readOnly?: boolean;
}

export const MetaDataEntry: React.FC<MetaDataEntryProps> = ({ values, onChange, readOnly }) => {
  const [errors, setErrors] = useState<Partial<MetaDataValues>>({});

  const handleChange = (field: keyof MetaDataValues, value: string) => {
    if (readOnly) return;
    
    onChange({
      ...values,
      [field]: value,
    });

    // Clear error on change
    if (errors[field]) {
      setErrors({ ...errors, [field]: "" });
    }
  };

  const validateTaxNo = (taxNo: string) => {
    // Basic tax ID validation for TR
    return taxNo.length === 10 || taxNo.length === 11;
  };

  const handleBlur = (field: keyof MetaDataValues) => {
    const value = values[field];
    if (field === "taxNo" && value && !validateTaxNo(value)) {
      setErrors({ ...errors, [field]: "Geçersiz Vergi No" });
    }
  };

  return (
    <div className="metadata-container">
      <div className="metadata-field">
        <label className="metadata-label">CARİ KODU</label>
        <input
          type="text"
          className={`metadata-input ${errors.customerCode ? "error" : ""}`}
          value={values.customerCode}
          onChange={(e) => handleChange("customerCode", e.target.value)}
          onBlur={() => handleBlur("customerCode")}
          readOnly={readOnly}
          placeholder="C001"
        />
      </div>

      <div className="metadata-field">
        <label className="metadata-label">TİCARİ ÜNVAN</label>
        <input
          type="text"
          className={`metadata-input ${errors.businessName ? "error" : ""}`}
          value={values.businessName}
          onChange={(e) => handleChange("businessName", e.target.value)}
          onBlur={() => handleBlur("businessName")}
          readOnly={readOnly}
          placeholder="Şirket Adı"
        />
      </div>

      <div className="metadata-field">
        <label className="metadata-label">VERGİ NO</label>
        <input
          type="text"
          className={`metadata-input ${errors.taxNo ? "error" : ""}`}
          value={values.taxNo}
          onChange={(e) => handleChange("taxNo", e.target.value.toUpperCase())}
          onBlur={() => handleBlur("taxNo")}
          readOnly={readOnly}
          placeholder="1234567890"
          maxLength={11}
        />
        {errors.taxNo && <span className="metadata-error">{errors.taxNo}</span>}
      </div>

      <div className="metadata-field">
        <label className="metadata-label">ADRES</label>
        <input
          type="text"
          className={`metadata-input ${errors.address ? "error" : ""}`}
          value={values.address}
          onChange={(e) => handleChange("address", e.target.value)}
          onBlur={() => handleBlur("address")}
          readOnly={readOnly}
          placeholder="Sokak, Mahalle, İlçe"
        />
      </div>
    </div>
  );
};
