'use client';

import { Download } from 'lucide-react';
import { useDictionary } from '@/lib/i18n/LocaleContext';

// Two plain buttons side by side, back from the single ExportMenu dropdown:
// the redesign screenshots show CSV and XLSX as separate one-click actions in
// the page header (see K2 in design/redesign-v2/PLAN.md).
export function ExportButtons({ csvHref, xlsxHref }: { csvHref: string; xlsxHref: string }) {
  const dict = useDictionary();

  return (
    <div className="export-buttons">
      <a className="export-btn" href={csvHref} data-testid="export-csv">
        <Download size={14} strokeWidth={1.75} />
        {dict.export.csv}
      </a>
      <a className="export-btn" href={xlsxHref} data-testid="export-xlsx">
        <Download size={14} strokeWidth={1.75} />
        {dict.export.xlsx}
      </a>
    </div>
  );
}
