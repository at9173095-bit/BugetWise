import { formatCurrency } from './storage';

export const CATEGORY_COLORS: Record<string, string> = {
  Food: '#10B981', // Emerald
  Transport: '#3B82F6', // Blue
  Education: '#8B5CF6', // Purple
  Bills: '#F59E0B', // Amber
  Shopping: '#EC4899', // Pink
  Entertainment: '#6366F1', // Indigo
  Health: '#EF4444', // Red
  Family: '#14B8A6', // Teal
  Savings: '#059669', // Dark emerald
  Other: '#6B7280', // Gray
};

export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] || '#64748B';
}

/**
 * Renders an SVG Daily Spending Line Chart
 */
export function renderDailyLineChart(
  container: HTMLElement,
  data: { date: string; label: string; amount: number }[]
): void {
  container.innerHTML = '';
  if (!data || data.length === 0) {
    container.innerHTML = `<div class="flex items-center justify-center h-full text-slate-400 text-sm">No daily spending recorded for this period</div>`;
    return;
  }

  const width = container.clientWidth || 500;
  const height = 240;
  const padding = { top: 20, right: 25, bottom: 40, left: 55 };

  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const maxAmount = Math.max(...data.map((d) => d.amount), 500);
  const niceMax = Math.ceil(maxAmount / 100) * 100;

  // Grid lines
  const gridCount = 4;
  let gridLinesSvg = '';
  for (let i = 0; i <= gridCount; i++) {
    const yVal = (niceMax / gridCount) * i;
    const yPos = padding.top + innerHeight - (yVal / niceMax) * innerHeight;
    gridLinesSvg += `
      <line x1="${padding.left}" y1="${yPos}" x2="${width - padding.right}" y2="${yPos}" stroke="currentColor" stroke-opacity="0.1" stroke-dasharray="3,3" />
      <text x="${padding.left - 8}" y="${yPos + 4}" font-size="10" text-anchor="end" class="fill-slate-400 font-mono">${formatCurrency(yVal)}</text>
    `;
  }

  // Calculate points
  const points = data.map((d, index) => {
    const x = padding.left + (index / Math.max(data.length - 1, 1)) * innerWidth;
    const y = padding.top + innerHeight - (d.amount / niceMax) * innerHeight;
    return { x, y, ...d };
  });

  // Construct SVG path
  let pathD = '';
  points.forEach((p, idx) => {
    if (idx === 0) {
      pathD += `M ${p.x} ${p.y}`;
    } else {
      // Smooth curve with cubic bezier control points
      const prev = points[idx - 1];
      const cx1 = prev.x + (p.x - prev.x) / 2;
      const cy1 = prev.y;
      const cx2 = prev.x + (p.x - prev.x) / 2;
      const cy2 = p.y;
      pathD += ` C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p.x} ${p.y}`;
    }
  });

  const areaD = `${pathD} L ${points[points.length - 1].x} ${padding.top + innerHeight} L ${points[0].x} ${padding.top + innerHeight} Z`;

  // Dots and labels
  let interactiveNodes = '';
  points.forEach((p, i) => {
    // Show label for every point if <= 10 items, else step
    const showLabel = data.length <= 10 || i % Math.ceil(data.length / 7) === 0 || i === data.length - 1;
    interactiveNodes += `
      <g class="chart-point group cursor-pointer" data-date="${p.date}" data-amount="${p.amount}" data-label="${p.label}">
        <circle cx="${p.x}" cy="${p.y}" r="4" class="fill-emerald-500 stroke-white dark:stroke-slate-900 stroke-2 transition-all duration-150 hover:r-6 hover:fill-emerald-400" />
        ${
          showLabel
            ? `<text x="${p.x}" y="${height - 12}" font-size="10" text-anchor="middle" class="fill-slate-400 select-none">${p.label}</text>`
            : ''
        }
      </g>
    `;
  });

  const svg = `
    <svg viewBox="0 0 ${width} ${height}" class="w-full h-full overflow-visible" preserveAspectRatio="none">
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#10B981" stop-opacity="0.28" />
          <stop offset="100%" stop-color="#10B981" stop-opacity="0.0" />
        </linearGradient>
      </defs>
      ${gridLinesSvg}
      <path d="${areaD}" fill="url(#lineGrad)" />
      <path d="${pathD}" fill="none" stroke="#10B981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      ${interactiveNodes}
    </svg>
    <div id="chart-tooltip" class="absolute pointer-events-none hidden bg-slate-900 text-white text-xs px-2.5 py-1.5 rounded shadow-lg z-20 border border-slate-700 font-mono"></div>
  `;

  container.innerHTML = svg;

  // Add hover tooltip behavior
  const tooltip = container.querySelector('#chart-tooltip') as HTMLElement;
  const pointElements = container.querySelectorAll('.chart-point');

  pointElements.forEach((el) => {
    el.addEventListener('mouseenter', (e) => {
      const target = e.currentTarget as HTMLElement;
      const amount = Number(target.getAttribute('data-amount') || 0);
      const label = target.getAttribute('data-label') || '';
      const date = target.getAttribute('data-date') || '';

      if (tooltip) {
        tooltip.innerHTML = `
          <div class="font-sans text-[11px] text-slate-300 font-medium">${label || date}</div>
          <div class="text-emerald-400 font-bold text-xs mt-0.5">${formatCurrency(amount)}</div>
        `;
        tooltip.classList.remove('hidden');

        const rect = target.getBoundingClientRect();
        const parentRect = container.getBoundingClientRect();
        tooltip.style.left = `${rect.left - parentRect.left - tooltip.offsetWidth / 2 + 5}px`;
        tooltip.style.top = `${rect.top - parentRect.top - tooltip.offsetHeight - 8}px`;
      }
    });

    el.addEventListener('mouseleave', () => {
      if (tooltip) tooltip.classList.add('hidden');
    });
  });
}

/**
 * Renders an SVG Category Spending Doughnut Chart
 */
export function renderCategoryDoughnutChart(
  container: HTMLElement,
  data: { category: string; amount: number }[]
): void {
  container.innerHTML = '';
  const filteredData = data.filter((d) => d.amount > 0);
  const total = filteredData.reduce((sum, d) => sum + d.amount, 0);

  if (total === 0 || filteredData.length === 0) {
    container.innerHTML = `<div class="flex items-center justify-center h-48 text-slate-400 text-sm">No expenses in this month yet</div>`;
    return;
  }

  const size = 200;
  const center = size / 2;
  const radius = 80;
  const strokeWidth = 28;

  let cumulativeAngle = 0;
  let slicesSvg = '';

  filteredData.forEach((item) => {
    const fraction = item.amount / total;
    const sweepAngle = fraction * 360;
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + sweepAngle;
    cumulativeAngle += sweepAngle;

    const startRad = ((startAngle - 90) * Math.PI) / 180;
    const endRad = ((endAngle - 90) * Math.PI) / 180;

    const x1 = center + radius * Math.cos(startRad);
    const y1 = center + radius * Math.sin(startRad);
    const x2 = center + radius * Math.cos(endRad);
    const y2 = center + radius * Math.sin(endRad);

    const largeArcFlag = sweepAngle > 180 ? 1 : 0;
    const color = getCategoryColor(item.category);
    const pct = Math.round(fraction * 100);

    // If single slice takes full 100%, render full circle
    let pathD = '';
    if (fraction >= 0.999) {
      pathD = `M ${center} ${center - radius} A ${radius} ${radius} 0 1 1 ${center - 0.01} ${center - radius}`;
    } else {
      pathD = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`;
    }

    slicesSvg += `
      <path d="${pathD}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" 
            class="transition-all duration-200 hover:opacity-85 cursor-pointer"
            data-category="${item.category}" data-amount="${item.amount}" data-percent="${pct}">
      </path>
    `;
  });

  // Clean legend HTML
  const legendHtml = filteredData
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 6)
    .map((item) => {
      const pct = Math.round((item.amount / total) * 100);
      const color = getCategoryColor(item.category);
      return `
        <div class="flex items-center justify-between text-xs py-1">
          <div class="flex items-center gap-1.5 min-w-0">
            <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: ${color}"></span>
            <span class="text-slate-700 dark:text-slate-300 truncate">${item.category}</span>
          </div>
          <div class="flex items-center gap-2 tabular-nums">
            <span class="font-medium text-slate-900 dark:text-slate-100">${formatCurrency(item.amount)}</span>
            <span class="text-slate-400 text-[11px]">${pct}%</span>
          </div>
        </div>
      `;
    })
    .join('');

  container.innerHTML = `
    <div class="flex flex-col sm:flex-row items-center gap-6 justify-center">
      <div class="relative w-[${size}px] h-[${size}px] shrink-0">
        <svg viewBox="0 0 ${size} ${size}" class="w-full h-full transform -rotate-0">
          ${slicesSvg}
        </svg>
        <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span class="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Total Spent</span>
          <span class="text-base font-bold text-slate-900 dark:text-white tabular-nums font-mono">${formatCurrency(total)}</span>
        </div>
      </div>
      <div class="flex-1 w-full max-w-xs space-y-1">
        ${legendHtml}
      </div>
    </div>
  `;
}

/**
 * Renders an SVG Budget vs Actual Spending Comparison Bar Chart
 */
export function renderBudgetVsActualChart(
  container: HTMLElement,
  data: { category: string; planned: number; spent: number }[]
): void {
  container.innerHTML = '';
  if (!data || data.length === 0) {
    container.innerHTML = `<div class="flex items-center justify-center h-48 text-slate-400 text-sm">No budget categories defined</div>`;
    return;
  }

  const height = 240;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const width = container.clientWidth || 500;
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const maxVal = Math.max(
    ...data.map((d) => Math.max(d.planned, d.spent)),
    1000
  );
  const niceMax = Math.ceil(maxVal / 1000) * 1000;

  // Gridlines
  let gridSvg = '';
  const gridSteps = 4;
  for (let i = 0; i <= gridSteps; i++) {
    const yVal = (niceMax / gridSteps) * i;
    const yPos = padding.top + innerHeight - (yVal / niceMax) * innerHeight;
    gridSvg += `
      <line x1="${padding.left}" y1="${yPos}" x2="${width - padding.right}" y2="${yPos}" stroke="currentColor" stroke-opacity="0.1" stroke-dasharray="2,2" />
      <text x="${padding.left - 6}" y="${yPos + 4}" font-size="10" text-anchor="end" class="fill-slate-400 font-mono">${formatCurrency(yVal)}</text>
    `;
  }

  // Grouped bars
  const groupWidth = innerWidth / data.length;
  const barWidth = Math.min(18, groupWidth * 0.35);

  let barsSvg = '';
  data.forEach((d, i) => {
    const groupX = padding.left + i * groupWidth + (groupWidth - barWidth * 2 - 4) / 2;
    const plannedHeight = (d.planned / niceMax) * innerHeight;
    const spentHeight = (d.spent / niceMax) * innerHeight;

    const plannedY = padding.top + innerHeight - plannedHeight;
    const spentY = padding.top + innerHeight - spentHeight;

    // Status color for spent bar
    let spentColor = '#10B981'; // green Safe
    if (d.planned > 0) {
      const pct = (d.spent / d.planned) * 100;
      if (pct >= 100) spentColor = '#EF4444'; // Over budget
      else if (pct >= 75) spentColor = '#F59E0B'; // Near limit
    }

    const shortCat = d.category.length > 6 ? d.category.substring(0, 5) + '…' : d.category;

    barsSvg += `
      <!-- Planned Bar -->
      <rect x="${groupX}" y="${plannedY}" width="${barWidth}" height="${plannedHeight}" rx="3" 
            class="fill-slate-300 dark:fill-slate-600 transition-all hover:opacity-80 cursor-pointer">
        <title>Planned: ${formatCurrency(d.planned)}</title>
      </rect>
      
      <!-- Actual Spent Bar -->
      <rect x="${groupX + barWidth + 4}" y="${spentY}" width="${barWidth}" height="${spentHeight}" rx="3" 
            fill="${spentColor}" class="transition-all hover:opacity-80 cursor-pointer">
        <title>Spent: ${formatCurrency(d.spent)} (${d.planned > 0 ? Math.round((d.spent / d.planned) * 100) : 0}%)</title>
      </rect>

      <!-- Label -->
      <text x="${groupX + barWidth + 2}" y="${height - 15}" font-size="10" text-anchor="middle" class="fill-slate-400">${shortCat}</text>
    `;
  });

  container.innerHTML = `
    <div class="flex items-center justify-end gap-4 mb-2 text-xs">
      <div class="flex items-center gap-1.5">
        <span class="w-3 h-3 rounded bg-slate-300 dark:bg-slate-600"></span>
        <span class="text-slate-500">Planned Budget</span>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="w-3 h-3 rounded bg-emerald-500"></span>
        <span class="text-slate-500">Actual Spending</span>
      </div>
    </div>
    <svg viewBox="0 0 ${width} ${height}" class="w-full h-[220px] overflow-visible">
      ${gridSvg}
      ${barsSvg}
    </svg>
  `;
}

/**
 * Renders an SVG Monthly Comparison Chart (Income vs Expense vs Savings)
 */
export function renderMonthlyComparisonChart(
  container: HTMLElement,
  monthsData: { monthLabel: string; income: number; expenses: number; savings: number }[]
): void {
  container.innerHTML = '';
  if (!monthsData || monthsData.length === 0) {
    container.innerHTML = `<div class="flex items-center justify-center h-48 text-slate-400 text-sm">No historical data available</div>`;
    return;
  }

  const height = 240;
  const padding = { top: 20, right: 20, bottom: 40, left: 55 };
  const width = container.clientWidth || 500;
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const maxVal = Math.max(
    ...monthsData.map((d) => Math.max(d.income, d.expenses, d.savings)),
    5000
  );
  const niceMax = Math.ceil(maxVal / 5000) * 5000;

  // Grid
  let gridSvg = '';
  const gridSteps = 4;
  for (let i = 0; i <= gridSteps; i++) {
    const yVal = (niceMax / gridSteps) * i;
    const yPos = padding.top + innerHeight - (yVal / niceMax) * innerHeight;
    gridSvg += `
      <line x1="${padding.left}" y1="${yPos}" x2="${width - padding.right}" y2="${yPos}" stroke="currentColor" stroke-opacity="0.1" stroke-dasharray="2,2" />
      <text x="${padding.left - 6}" y="${yPos + 4}" font-size="10" text-anchor="end" class="fill-slate-400 font-mono">${formatCurrency(yVal)}</text>
    `;
  }

  const groupWidth = innerWidth / monthsData.length;
  const barWidth = Math.min(22, (groupWidth - 20) / 3);

  let barsSvg = '';
  monthsData.forEach((m, idx) => {
    const groupCenter = padding.left + idx * groupWidth + groupWidth / 2;
    const startX = groupCenter - (barWidth * 3 + 8) / 2;

    const incH = (m.income / niceMax) * innerHeight;
    const expH = (m.expenses / niceMax) * innerHeight;
    const savH = (Math.max(0, m.savings) / niceMax) * innerHeight;

    const incY = padding.top + innerHeight - incH;
    const expY = padding.top + innerHeight - expH;
    const savY = padding.top + innerHeight - savH;

    barsSvg += `
      <!-- Income -->
      <rect x="${startX}" y="${incY}" width="${barWidth}" height="${incH}" rx="3" class="fill-indigo-500 transition-all hover:opacity-85 cursor-pointer">
        <title>Income: ${formatCurrency(m.income)}</title>
      </rect>
      <!-- Expenses -->
      <rect x="${startX + barWidth + 4}" y="${expY}" width="${barWidth}" height="${expH}" rx="3" class="fill-rose-500 transition-all hover:opacity-85 cursor-pointer">
        <title>Expenses: ${formatCurrency(m.expenses)}</title>
      </rect>
      <!-- Savings -->
      <rect x="${startX + (barWidth + 4) * 2}" y="${savY}" width="${barWidth}" height="${savH}" rx="3" class="fill-emerald-500 transition-all hover:opacity-85 cursor-pointer">
        <title>Savings: ${formatCurrency(m.savings)}</title>
      </rect>

      <!-- Month Label -->
      <text x="${groupCenter}" y="${height - 12}" font-size="11" text-anchor="middle" class="fill-slate-500 dark:fill-slate-400 font-medium">${m.monthLabel}</text>
    `;
  });

  container.innerHTML = `
    <div class="flex items-center justify-end gap-4 mb-2 text-xs">
      <div class="flex items-center gap-1.5">
        <span class="w-3 h-3 rounded bg-indigo-500"></span>
        <span class="text-slate-500">Income</span>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="w-3 h-3 rounded bg-rose-500"></span>
        <span class="text-slate-500">Expenses</span>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="w-3 h-3 rounded bg-emerald-500"></span>
        <span class="text-slate-500">Savings</span>
      </div>
    </div>
    <svg viewBox="0 0 ${width} ${height}" class="w-full h-[220px] overflow-visible">
      ${gridSvg}
      ${barsSvg}
    </svg>
  `;
}
