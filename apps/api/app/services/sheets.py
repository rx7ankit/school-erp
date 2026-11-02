"""Reading uploaded Excel/CSV files and writing Excel files. Shared by every import and export."""

import csv
import io
import re
from collections.abc import Iterable
from datetime import date, datetime
from typing import Any

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font
from openpyxl.utils import get_column_letter

from app.core.errors import AppError

MAX_BYTES = 5 * 1024 * 1024
MAX_ROWS = 2000
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def norm_header(h: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "_", str(h or "").strip().lower()).strip("_")


def _cell(v: Any) -> Any:
    """One cell as a string, or a date when Excel holds a date."""
    if v is None:
        return None
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    s = str(v).strip()
    return s or None


def read_table(
    data: bytes, filename: str, *, aliases: dict[str, str], required: Iterable[str]
) -> list[tuple[int, dict[str, Any]]]:
    """Returns [(row number as seen in the sheet, {column: value})]. Column names are mapped through `aliases`
    (normalised header -> canonical name). Empty rows are skipped. Raises a 422 for an unreadable file or
    missing columns."""
    if len(data) > MAX_BYTES:
        raise AppError("The file is too large (5 MB at most).", code="file_too_large", status=413)
    name = filename.lower()
    try:
        if name.endswith(".csv"):
            text = data.decode("utf-8-sig")
            raw = [list(r) for r in csv.reader(io.StringIO(text))]
        elif name.endswith((".xlsx", ".xlsm")):
            wb = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
            raw = [list(r) for r in wb.worksheets[0].iter_rows(values_only=True)]
            wb.close()
        else:
            raise AppError("Upload an .xlsx or .csv file.", code="unsupported_file", status=422)
    except AppError:
        raise
    except Exception as e:  # noqa: BLE001
        raise AppError(
            "This file could not be read. Is it a valid Excel or CSV file?", code="unreadable_file", status=422
        ) from e
    if not raw:
        raise AppError("The file is empty.", code="empty_file", status=422)
    header = [aliases.get(norm_header(h), norm_header(h)) for h in raw[0]]
    missing = [c for c in required if c not in header]
    if missing:
        raise AppError(
            "These columns are missing: " + ", ".join(missing), code="missing_columns", status=422, details=missing
        )
    out: list[tuple[int, dict[str, Any]]] = []
    for i, row in enumerate(raw[1:], start=2):
        rec = {}
        for col, v in zip(header, row, strict=False):
            if col and col not in rec:
                rec[col] = _cell(v)
        if any(v is not None for v in rec.values()):
            out.append((i, rec))
    if len(out) > MAX_ROWS:
        raise AppError(f"At most {MAX_ROWS} rows per file.", code="too_many_rows", status=422)
    return out


def safe(v: Any) -> Any:
    """Stops a text cell from being run as a formula when opened in Excel."""
    if isinstance(v, str) and v[:1] in ("=", "+", "-", "@"):
        return "'" + v
    return v


def build_xlsx(sheets: list[tuple[str, list[str], list[list[Any]]]]) -> bytes:
    """sheets: [(title, headers, rows)]. Dates stay real dates, text is made formula-safe."""
    wb = Workbook()
    wb.remove(wb.active)
    for title, headers, rows in sheets:
        ws = wb.create_sheet(title[:31])
        ws.append(headers)
        for c in ws[1]:
            c.font = Font(bold=True)
        for r in rows:
            ws.append([safe(v) for v in r])
        for i, h in enumerate(headers, start=1):
            width = max([len(str(h))] + [len(str(r[i - 1] or "")) for r in rows[:200]])
            ws.column_dimensions[get_column_letter(i)].width = min(max(width + 2, 10), 50)
        ws.freeze_panes = "A2"
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
