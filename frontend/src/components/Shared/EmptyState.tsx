import { ReactNode } from "react";
import { Package, Search, FileText, Users, Inbox, AlertCircle } from "lucide-react";
import { COLORS, RADIUS, TYPOGRAPHY } from "./constants";
import { Button } from "./Button";

// Icon mapping for empty states
const emptyStateIcons = {
  package: Package,
  search: Search,
  file: FileText,
  users: Users,
  inbox: Inbox,
  alert: AlertCircle,
};

interface EmptyStateProps {
  icon?: keyof typeof emptyStateIcons;
  customIcon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: "primary" | "secondary" | "ghost";
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  compact?: boolean;
  className?: string;
}

export const EmptyState = ({
  icon = "inbox",
  customIcon,
  title,
  description,
  action,
  secondaryAction,
  compact = false,
  className,
}: EmptyStateProps) => {
  const IconComponent = emptyStateIcons[icon];

  return (
    <div
      className={`empty-state ${className || ""}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: compact ? "24px" : "48px 24px",
        textAlign: "center",
        background: `linear-gradient(180deg, ${COLORS.bg.surface}, ${COLORS.bg.main})`,
        borderRadius: RADIUS.lg,
        border: `1px dashed ${COLORS.border}`,
        minHeight: compact ? 160 : 280,
      }}
    >
      {/* Icon Container */}
      <div
        style={{
          width: compact ? 48 : 72,
          height: compact ? 48 : 72,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${COLORS.primary[500]}15, ${COLORS.primary[700]}15)`,
          border: `1px solid ${COLORS.primary[500]}30`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: compact ? 12 : 20,
          color: COLORS.primary[400],
        }}
      >
        {customIcon || <IconComponent size={compact ? 24 : 36} strokeWidth={1.5} />}
      </div>

      {/* Title */}
      <h3
        style={{
          margin: 0,
          fontSize: compact ? TYPOGRAPHY.fontSize.lg : TYPOGRAPHY.fontSize.xl,
          fontWeight: TYPOGRAPHY.fontWeight.semibold,
          color: COLORS.text,
          fontFamily: TYPOGRAPHY.fontFamily.heading,
        }}
      >
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p
          style={{
            margin: "8px 0 0",
            fontSize: compact ? TYPOGRAPHY.fontSize.sm : TYPOGRAPHY.fontSize.base,
            color: COLORS.muted,
            lineHeight: 1.5,
            maxWidth: 400,
          }}
        >
          {description}
        </p>
      )}

      {/* Actions */}
      {(action || secondaryAction) && (
        <div
          style={{
            display: "flex",
            gap: 12,
            marginTop: compact ? 16 : 24,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {action && (
            <Button
              onClick={action.onClick}
              variant={action.variant || "primary"}
              size={compact ? "sm" : "md"}
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              onClick={secondaryAction.onClick}
              variant="ghost"
              size={compact ? "sm" : "md"}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

// Specialized empty states for common scenarios
export const EmptySearchResults = ({
  searchTerm,
  onClear,
  className,
}: {
  searchTerm: string;
  onClear: () => void;
  className?: string;
}) => (
  <EmptyState
    icon="search"
    title="Sonuç bulunamadı"
    description={`"${searchTerm}" için sonuç bulunamadı. Farklı anahtar kelimeler deneyebilirsiniz.`}
    action={{ label: "Aramayı Temizle", onClick: onClear, variant: "secondary" }}
    className={className}
  />
);

export const EmptyData = ({
  entityName,
  onCreate,
  className,
}: {
  entityName: string;
  onCreate?: () => void;
  className?: string;
}) => (
  <EmptyState
    icon="package"
    title={`Henüz ${entityName} bulunmuyor`}
    description={`İlk ${entityName} oluşturmak için aşağıdaki butonu kullanabilirsiniz.`}
    action={
      onCreate
        ? { label: `${entityName} Ekle`, onClick: onCreate, variant: "primary" }
        : undefined
    }
    className={className}
  />
);

export const EmptyList = ({
  title,
  description,
  onRefresh,
  className,
}: {
  title: string;
  description?: string;
  onRefresh?: () => void;
  className?: string;
}) => (
  <EmptyState
    icon="inbox"
    title={title}
    description={description || "Bu listede henüz öğe bulunmuyor."}
    action={
      onRefresh
        ? { label: "Yenile", onClick: onRefresh, variant: "secondary" }
        : undefined
    }
    compact
    className={className}
  />
);

export const ErrorState = ({
  title = "Bir hata oluştu",
  description,
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) => (
  <EmptyState
    icon="alert"
    title={title}
    description={description || "Veriler yüklenirken bir hata oluştu. Lütfen tekrar deneyin."}
    action={
      onRetry
        ? { label: "Tekrar Dene", onClick: onRetry, variant: "primary" }
        : undefined
    }
    className={className}
  />
);

export default EmptyState;
