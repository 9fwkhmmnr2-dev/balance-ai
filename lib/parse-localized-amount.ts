/**
 * Interpreta importes escritos con convenciones habituales de Argentina.
 * Ejemplos: 160.000 -> 160000; 160.000,50 -> 160000.5; 160,50 -> 160.5.
 */
export function parseLocalizedAmount(raw: string): number | null {
  let value = raw.trim().replace(/[\s\u00A0]/g, "").replace(/[^0-9,.-]/g, "");
  if (!value) return null;
  if (value.startsWith("-")) return null;
  value = value.replace(/-/g, "");

  const lastComma = value.lastIndexOf(",");
  const lastDot = value.lastIndexOf(".");
  let normalized = value;

  if (lastComma !== -1 && lastDot !== -1) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const groupingSeparator = decimalSeparator === "," ? "." : ",";
    normalized = value.split(groupingSeparator).join("");
    if (decimalSeparator === ",") normalized = normalized.replace(",", ".");
    else normalized = normalized.replace(",", "");
  } else {
    const separator = lastComma !== -1 ? "," : lastDot !== -1 ? "." : "";
    if (separator) {
      const parts = value.split(separator);
      const trailingDigits = parts[parts.length - 1].length;
      const allThousandsGroups = parts.length > 1 &&
        parts.slice(1).every((part) => part.length === 3) &&
        parts[0].length >= 1 && parts[0].length <= 3;
      if (allThousandsGroups || (separator === "." && trailingDigits === 3 && parts.length === 2)) {
        normalized = parts.join("");
      } else if (parts.length === 2) {
        normalized = parts[0] + "." + parts[1];
      } else {
        // Multiple separators of the same kind are treated as grouping marks.
        normalized = parts.join("");
      }
    }
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
