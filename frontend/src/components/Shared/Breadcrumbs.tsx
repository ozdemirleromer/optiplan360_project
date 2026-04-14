import { ChevronRight } from "lucide-react";
import { COLORS } from "./constants";

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
  href?: string;
}

export interface BreadcrumbsProps {
  items: (string | BreadcrumbItem)[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  if (!items || items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb navigasyonu">
      <ol
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          listStyle: "none",
          margin: 0,
          padding: 0,
          fontSize: 13,
        }}
      >
        {items.map((item, index) => {
          const isString = typeof item === "string";
          const label = isString ? item : item.label;
          const isLast = index === items.length - 1;

          const content = isLast || isString ? (
            <span
              style={{
                color: isLast ? COLORS.text : COLORS.muted,
                fontWeight: isLast ? 500 : 400,
                transition: "color 0.2s",
              }}
              aria-current={isLast ? "page" : undefined}
            >
              {label}
            </span>
          ) : (
            <a
              href={item.href}
              onClick={(e) => {
                if (item.onClick) {
                  e.preventDefault();
                  item.onClick();
                }
              }}
              style={{
                color: COLORS.muted,
                textDecoration: "none",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = COLORS.primary)}
              onMouseLeave={(e) => (e.currentTarget.style.color = COLORS.muted)}
            >
              {label}
            </a>
          );

          return (
            <li key={`${label}-${index}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {index > 0 && <ChevronRight size={14} color={COLORS.muted} aria-hidden="true" />}
              {content}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
