import { Download } from "lucide-react";
import { Button } from "../Shared";

interface PriceExportButtonProps {
  selectedCount: number;
  exporting: boolean;
  onExport: () => void;
}

export function PriceExportButton({
  selectedCount,
  exporting,
  onExport,
}: PriceExportButtonProps) {
  const disabled = selectedCount === 0 || exporting;
  return (
    <Button
      variant="secondary"
      onClick={onExport}
      disabled={disabled}
      loading={exporting}
      icon={<Download size={14} />}
      title={
        disabled
          ? "Excel aktarma icin en az bir is secmelisiniz"
          : "Secili isleri Excel'e aktar"
      }
    >
      {exporting
        ? "Excel hazirlaniyor..."
        : `Excel'e Aktar (${selectedCount})`}
    </Button>
  );
}

export default PriceExportButton;
