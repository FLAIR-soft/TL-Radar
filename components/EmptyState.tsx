import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

export function EmptyState({
  icon: Icon,
  title,
  subtitle,
  ctaHref,
  ctaLabel,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <Icon size={26} strokeWidth={1.5} />
      </div>
      <div className="empty-state-title">{title}</div>
      {subtitle && <p className="empty-state-sub">{subtitle}</p>}
      {ctaHref && ctaLabel && (
        <Link href={ctaHref} className="btn btn-primary empty-state-cta">
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}
