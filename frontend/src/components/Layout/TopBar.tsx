import { NotificationDropdown } from "../Shared";
import { GlobalSearchBar } from "./GlobalSearchBar";
import "./topbar.css";

interface TopBarProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: string[];
  children?: React.ReactNode;
  centerContent?: React.ReactNode;
}

export const TopBar = ({ title, subtitle, breadcrumbs, children, centerContent }: TopBarProps) => {
  const hasCenterContent = Boolean(centerContent);

  return (
    <header className="topbar-shell">
      {breadcrumbs ? (
        <nav className="topbar-breadcrumbs" aria-label="Breadcrumb navigasyonu">
          <ol>
            {breadcrumbs.map((crumb, index) => (
              <li key={crumb + index}>
                {index > 0 ? (
                  <span className="topbar-breadcrumb-separator" aria-hidden="true">
                    /
                  </span>
                ) : null}
                <span className={index === breadcrumbs.length - 1 ? "is-current" : ""}>{crumb}</span>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      <div className={`topbar-layout ${hasCenterContent ? "has-center" : ""}`}>
        <div className={`topbar-heading ${hasCenterContent ? "with-center" : ""}`}>
          <h1 className="topbar-title">{title}</h1>
          {subtitle ? <p className="topbar-subtitle">{subtitle}</p> : null}
        </div>

        {hasCenterContent ? <div className="topbar-center-slot">{centerContent}</div> : null}

        <div className="topbar-tools" role="region" aria-label="Sayfa araclari">
          {!hasCenterContent ? <GlobalSearchBar /> : null}
          {children}
          <NotificationDropdown />
        </div>
      </div>
    </header>
  );
};
