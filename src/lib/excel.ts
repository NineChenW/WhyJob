/**
 * Excel column letter to index conversion utility
 * Converts Excel column letters (A, B, ..., Z, AA, AB, ..., AZ, BA, ...) to 0-based indexes
 */

/**
 * Convert Excel column letter(s) to 0-based index
 * @param col - Excel column letter(s) like "A", "B", "AA", "AB", etc.
 * @returns 0-based index (A=0, B=1, ..., Z=25, AA=26, etc.)
 */
export function getColumnIndex(col: string): number {
  const upperCol = col.toUpperCase();
  let index = 0;
  for (let i = 0; i < upperCol.length; i++) {
    index = index * 26 + (upperCol.charCodeAt(i) - 64); // A=1, B=2, etc.
  }
  return index - 1; // Convert to 0-index
}