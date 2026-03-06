import type { MutableRefObject } from "react";
import { orderOptimizationStyles } from "./orderOptimizationStyles";

interface OrderOptimizationMetaStripProps {
  customerValue: string;
  orderNo: string;
  dueDate: string;
  customerSuggestions: string[];
  customerInputRef?: MutableRefObject<HTMLInputElement | null>;
  onCustomerChange: (value: string) => void;
  onDueDateChange: (value: string) => void;
}

export function OrderOptimizationMetaStrip({
  customerValue,
  orderNo,
  dueDate,
  customerSuggestions,
  customerInputRef,
  onCustomerChange,
  onDueDateChange,
}: OrderOptimizationMetaStripProps) {
  return (
    <div className={orderOptimizationStyles.metaStrip}>
      <label className={`${orderOptimizationStyles.metaBlock} w-[500px] shrink-0`}>
        <span className={`${orderOptimizationStyles.metaLabel} whitespace-nowrap`}>Cari Ünvan</span>
        <input
          ref={customerInputRef}
          list="order-optimization-customers"
          value={customerValue}
          onChange={(event) => onCustomerChange(event.target.value)}
          className={`${orderOptimizationStyles.input} w-full`}
          placeholder="Firma Adı | 5XXXXXXXXX"
        />
        <datalist id="order-optimization-customers">
          {customerSuggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
      </label>

      <label className={`${orderOptimizationStyles.metaBlock} w-[250px] shrink-0`}>
        <span className={`${orderOptimizationStyles.metaLabel} whitespace-nowrap`}>Sipariş No</span>
        <input value={orderNo} disabled className={`${orderOptimizationStyles.inputDisabled} w-full font-mono`} />
      </label>

      <label className={`${orderOptimizationStyles.metaBlock} w-[250px] shrink-0`}>
        <span className={orderOptimizationStyles.metaLabel}>Termin</span>
        <input type="date" value={dueDate} onChange={(event) => onDueDateChange(event.target.value)} className={`${orderOptimizationStyles.input} w-full`} />
      </label>
    </div>
  );
}
