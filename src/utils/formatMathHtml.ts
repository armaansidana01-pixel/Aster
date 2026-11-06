/**
 * Converts inline LaTeX math fragments ($...$ and $$...$$) into clean, semantic HTML math typography.
 */
export function formatMathHtml(html?: string): string {
  if (!html) return '';
  return html
    .replace(/\$\$(.*?)\$\$/g, '<div class="my-2 font-mono font-semibold text-indigo-700 dark:text-indigo-300">$1</div>')
    .replace(/\$(.*?)\$/g, '<span class="font-mono font-medium">$1</span>')
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)')
    .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
    .replace(/\\le/g, '≤')
    .replace(/\\ge/g, '≥')
    .replace(/\\times/g, '×')
    .replace(/\\pi/g, 'π')
    .replace(/\\ell/g, 'ℓ')
    .replace(/\\angle/g, '∠')
    .replace(/\\sin/g, 'sin')
    .replace(/\\implies/g, '⇒')
    .replace(/\^\\circ/g, '°')
    .replace(/\^2/g, '²')
    .replace(/\^3/g, '³')
    .replace(/_2/g, '₂')
    .replace(/_1/g, '₁')
    .replace(/_0/g, '₀');
}
