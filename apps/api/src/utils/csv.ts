/**
 * CSV cell encoding that also neutralizes spreadsheet formulas. No imports on purpose.
 */

const FORMULA_START = /^[=+\-@\t\r]/;
/** Plain numbers and phone numbers ("+573001234567", "-12", "(300) 123-4567") are left untouched. */
const NUMERIC_OR_PHONE = /^[+-]?[0-9][0-9\s().-]*$/;

/**
 * Text → CSV cell. A value that starts with = + - @ tab or CR and is not numeric/phone gets a leading
 * single quote (so Excel/Sheets show it as text), then the usual CSV escaping is applied.
 * `alwaysQuote` wraps every cell in double quotes (the export worker's historical format).
 */
export function csvCell(value: unknown, alwaysQuote = false): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (FORMULA_START.test(text) && !NUMERIC_OR_PHONE.test(text)) {
    text = `'${text}`;
  }
  const needsQuotes = alwaysQuote || /[",\r\n]/.test(text);
  return needsQuotes ? `"${text.replace(/"/g, '""')}"` : text;
}
