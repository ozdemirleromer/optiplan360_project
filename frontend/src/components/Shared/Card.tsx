import { CSSProperties, useState } from "react";
import "./card.css";

interface CardProps {
  children: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  hoverable?: boolean;
  style?: CSSProperties;
  role?: string;
  "aria-label"?: string;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
}

export const Card = ({
  children,
  title,
  subtitle,
  icon,
  actions,
  hoverable = false,
  style: sx = {},
  className,
  ...rest
}: CardProps) => {
  const [hov, setHov] = useState(false);
  const classes = [
    "shared-card",
    hoverable ? "is-hoverable" : "",
    hov ? "is-hovered" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classes}
      onMouseEnter={() => hoverable && setHov(true)}
      onMouseLeave={() => hoverable && setHov(false)}
      style={sx}
      {...rest}
    >
      {(title || actions) && (
        <div className="shared-card-header">
          <div className="shared-card-heading">
            {icon ? <span className="shared-card-icon">{icon}</span> : null}
            <div className="shared-card-title-wrap">
              {title ? <span className="shared-card-title">{title}</span> : null}
              {subtitle ? <span className="shared-card-subtitle">{subtitle}</span> : null}
            </div>
          </div>
          {actions ? <div className="shared-card-actions">{actions}</div> : null}
        </div>
      )}
      <div className={`shared-card-body ${title || actions ? "has-header" : "is-standalone"}`}>{children}</div>
    </div>
  );
};
