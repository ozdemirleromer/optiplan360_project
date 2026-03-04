import type { MutableRefObject } from "react";
import { orderOptimizationStyles } from "./orderOptimizationStyles";

interface OrderOptimizationMetaStripProps {
  customerValue: string;
  orderNo: string;
  dueDate: string;
  plateBoy: string;
  plateEn: string;
  customerSuggestions: string[];
  customerInputRef?: MutableRefObject<HTMLInputElement | null>;
  onCustomerChange: (value: string) => void;
  onDueDateChange: (value: string) => void;
  onPlateBoyChange: (value: string) => void;
  onPlateEnChange: (value: string) => void;
  onPlateBoyBlur: () => void;
  onPlateEnBlur: () => void;
}

export function OrderOptimizationMetaStrip({
  customerValue,
  orderNo,
  dueDate,
  plateBoy,
  plateEn,
  customerSuggestions,
  customerInputRef,
  onCustomerChange,
  onDueDateChange,
  onPlateBoyChange,
  onPlateEnChange,
  onPlateBoyBlur,
  onPlateEnBlur,
}: OrderOptimizationMetaStripProps) {
  return (
    <div className={orderOptimizationStyles.metaStrip}>
      <label className={`${orderOptimizationStyles.metaBlock} w-[32%] min-w-[280px]`}>
        <span className={orderOptimizationStyles.metaLabel}>Cari Ünvan</span>
        <input
          ref={customerInputRef}
          list="order-optimization-customers"
          value={customerValue}
          onChange={(event) => onCustomerChange(event.target.value)}
          className={orderOptimizationStyles.input}
          placeholder="Firma / Yetkili / Telefon"
        />
        <datalist id="order-optimization-customers">
          {customerSuggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
      </label>

      <label className={`${orderOptimizationStyles.metaBlock} w-[16%] min-w-[150px]`}>
        <span className={orderOptimizationStyles.metaLabel}>Sipariş No</span>
        <input value={orderNo} disabled className={`${orderOptimizationStyles.inputDisabled} font-mono`} />
      </label>

      <label className={`${orderOptimizationStyles.metaBlock} w-[14%] min-w-[132px]`}>
        <span className={orderOptimizationStyles.metaLabel}>Termin</span>
        <input
          type="date"
          value={dueDate}
          onChange={(event) => onDueDateChange(event.target.value)}
          className={orderOptimizationStyles.input}
        />
      </label>

      <div className={`${orderOptimizationStyles.metaBlock} w-[22%] min-w-[220px]`}>
        <span className={orderOptimizationStyles.metaLabel}>Plaka Boyutu</span>
        <div className="flex items-center gap-2">
          <input
            value={plateBoy}
            onChange={(event) => onPlateBoyChange(event.target.value)}
            onBlur={onPlateBoyBlur}
            className={`${orderOptimizationStyles.monoInput} font-mono`}
            inputMode="decimal"
            aria-label="Plaka boy"
          />
          <input
            value={plateEn}
            onChange={(event) => onPlateEnChange(event.target.value)}
            onBlur={onPlateEnBlur}
            className={`${orderOptimizationStyles.monoInput} font-mono`}
            inputMode="decimal"
            aria-label="Plaka en"
          />
        </div>
      </div>
    </div>
  );
}
