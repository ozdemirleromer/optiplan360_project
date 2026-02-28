/**
 * Breadcrumb Navigation Component
 * Kullanıcın nerede olduğunu gösterir
 * @example
 *   <Breadcrumb
 *     items={[
 *       { label: 'Dashboard', href: '/' },
 *       { label: 'Siparişler', href: '/orders' },
 *       { label: 'SP-2024-001' }
 *     ]}
 *   />
 */

import React from 'react';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  separator?: React.ReactNode;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  items,
  separator = <ChevronRight className="w-4 h-4 text-gray-400" />,
}) => {
  const handleClick = (item: BreadcrumbItem) => {
    if (item.onClick) {
      item.onClick();
    } else if (item.href) {
      window.location.href = item.href;
    }
  };

  return (
    <nav
      className="flex items-center gap-2 text-sm mb-4"
      aria-label="Breadcrumb"
    >
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <span className="text-gray-400" aria-hidden="true">
              {separator}
            </span>
          )}

          {item.href || item.onClick ? (
            <button
              onClick={() => handleClick(item)}
              className="text-blue-600 hover:text-blue-700 underline transition-colors"
            >
              {item.label}
            </button>
          ) : (
            <span className="text-gray-600 font-semibold">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

export const BreadcrumbHome: React.FC<{ items: BreadcrumbItem[] }> = ({ items }) => (
  <Breadcrumb
    items={[
      { label: 'Ana Sayfa', href: '/' },
      ...items,
    ]}
  />
);

// Structured data (JSON-LD) for SEO
export const BreadcrumbSchema: React.FC<{ items: BreadcrumbItem[] }> = ({ items }) => {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      item: item.href ? `${window.location.origin}${item.href}` : undefined,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
};
