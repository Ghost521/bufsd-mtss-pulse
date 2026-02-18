export type ParsedGradeScore = number | "M" | "E" | "L" | null;

export type PastedCellValue = {
  col: number;
  row: number;
  value: ParsedGradeScore;
};

export const parseGradeInput = (rawValue: string): ParsedGradeScore | undefined => {
  const trimmed = rawValue.trim();
  if (trimmed === "" || trimmed === "-") return null;

  const upper = trimmed.toUpperCase();
  if (upper === "M" || upper === "E" || upper === "L") return upper;

  const normalized = trimmed.endsWith("%") ? trimmed.slice(0, -1) : trimmed;
  if (!/^\d*\.?\d+$/.test(normalized)) return undefined;

  const numeric = Number(normalized);
  if (Number.isNaN(numeric) || numeric < 0 || numeric > 100) return undefined;
  return Math.round(numeric);
};

export const extractPastedCells = (
  rawClipboardText: string,
  startRow: number,
  startCol: number,
  maxRows: number,
  maxCols: number,
): PastedCellValue[] => {
  const rows = rawClipboardText
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);

  const cells: PastedCellValue[] = [];
  rows.forEach((line, rowOffset) => {
    const row = startRow + rowOffset;
    if (row >= maxRows) return;

    line.split("\t").forEach((cellText, colOffset) => {
      const col = startCol + colOffset;
      if (col >= maxCols) return;

      const parsed = parseGradeInput(cellText);
      if (parsed === undefined) return;
      cells.push({ row, col, value: parsed });
    });
  });

  return cells;
};

