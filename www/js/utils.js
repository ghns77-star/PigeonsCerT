// منطق مساعد منقول من النسخة المكتبية (Python) كما هو قدر الإمكان.

export const RING_COLOR_PALETTE = [
  ["أزرق FCI", "#00A6CE"], ["أحمر فاتح FCI", "#F58AA5"],
  ["أخضر FCI", "#8CCF00"], ["أصفر FCI", "#F5D900"],
  ["أبيض FCI", "#FFFFFF"],
  ["أحمر", "#E53935"], ["أزرق", "#1565C0"], ["أخضر", "#168A45"],
  ["أصفر", "#FFEB3B"], ["أسود", "#111111"], ["برتقالي", "#F57C00"],
  ["بنفسجي", "#7B1FA2"], ["بني", "#795548"], ["رمادي", "#808080"],
  ["وردي", "#E91E63"], ["سماوي", "#00BCD4"], ["كحلي", "#001F5B"],
  ["أحمر داكن", "#8B0000"], ["أحمر قرميدي", "#B22222"],
  ["قرمزي", "#DC143C"], ["مرجاني", "#FF7F50"],
  ["وردي فاتح", "#FFB6C1"], ["وردي غامق", "#C2185B"],
  ["سلموني", "#FA8072"], ["خوخي", "#FFCBA4"],
  ["برتقالي محروق", "#CC5500"], ["مشمشي", "#FBCEB1"],
  ["ذهبي", "#D4AF37"], ["أصفر خردلي", "#D4A017"],
  ["ليموني", "#DFFF00"], ["عاجي", "#FFFFF0"],
  ["كريمي", "#FFFDD0"], ["بيج", "#F5F5DC"],
  ["زيتي", "#808000"], ["أخضر فاتح", "#90EE90"],
  ["أخضر داكن", "#1B5E20"], ["نعناعي", "#98FF98"],
  ["زمردي", "#50C878"], ["فيروزي", "#40E0D0"],
  ["تركوازي", "#30D5C8"], ["أخضر بحري", "#2E8B57"],
  ["أزرق فاتح", "#64B5F6"], ["أزرق سماوي", "#87CEEB"],
  ["أزرق ملكي", "#4169E1"], ["أزرق داكن", "#00008B"],
  ["نيلي", "#4B0082"], ["بنفسجي فاتح", "#D8BFD8"],
  ["لافندر", "#B57EDC"], ["أرجواني", "#9C27B0"],
  ["موف", "#E0B0FF"], ["خمري", "#800020"],
  ["بني فاتح", "#C4A484"], ["بني داكن", "#4E342E"],
  ["شوكولاتي", "#7B3F00"], ["نحاسي", "#B87333"],
  ["رمادي فاتح", "#D3D3D3"], ["رمادي داكن", "#4F4F4F"],
  ["فضي", "#C0C0C0"], ["فحمي", "#36454F"],
  ["ذهبي فاتح", "#E6BE8A"], ["برونزي", "#CD7F32"],
  ["شفاف/غير محدد", "#F4F4F4"],
];
export const RING_COLOR_HEX = Object.fromEntries(RING_COLOR_PALETTE);

export const FCI_RING_COLORS = [
  "أزرق FCI", "أحمر فاتح FCI", "أخضر FCI", "أصفر FCI", "أبيض FCI",
];
export const FCI_RING_COLOR_START_YEAR = 2026;
export const FCI_NEXT_YEAR_MONTHS = [10, 11, 12];
export const GESTATION_DAYS = 18;

export function normalizeDigits(s) {
  if (!s) return s;
  return String(s)
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0));
}

export function cleanText(s) {
  if (!s) return s;
  return String(s)
    .replace(/[‏‎]/g, "")
    .replace(/ /g, " ")
    .trim();
}

export function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------- التواريخ (YYYY-MM-DD) ----------
export function parseISO(s) {
  if (!s) return null;
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(normalizeDigits(String(s)).trim());
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) {
    return null;
  }
  return dt;
}

export function toISO(dt) {
  const p = (n, l = 2) => String(n).padStart(l, "0");
  return `${p(dt.getFullYear(), 4)}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

export function validateDate(s) {
  if (!s) return true;
  return parseISO(s) !== null;
}

export function normalizeDate(s) {
  const dt = parseISO(s);
  return dt ? toISO(dt) : s;
}

export function daysUntil(dateStr, today = new Date()) {
  const d = parseISO(dateStr);
  if (!d) return null;
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((d - t0) / 86400000);
}

export function expectedHatchDate(eggDateStr) {
  const d = parseISO(eggDateStr);
  if (!d) return null;
  d.setDate(d.getDate() + GESTATION_DAYS);
  return toISO(d);
}

// ---------- ألوان الحجل ----------
export function effectiveRingYear(year, month = null) {
  if (month !== null && FCI_NEXT_YEAR_MONTHS.includes(month)) return year + 1;
  return year;
}

function colorByYearIndex(effYear) {
  const n = FCI_RING_COLORS.length;
  const idx = (((effYear - FCI_RING_COLOR_START_YEAR) % n) + n) % n;
  return FCI_RING_COLORS[idx];
}

export function fciRingColorForDate(dateObj = new Date()) {
  const eff = effectiveRingYear(dateObj.getFullYear(), dateObj.getMonth() + 1);
  return colorByYearIndex(eff);
}

export function fciRingColorForYear(year) {
  return colorByYearIndex(year || new Date().getFullYear());
}

export function ringColorHex(name) {
  if (name === "أبيض") return "#FFFFFF"; // توافق مع بيانات النسخة القديمة
  return RING_COLOR_HEX[name] || "#FFFFFF";
}

export function contrastFg(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return "#000000";
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? "#000000" : "#FFFFFF";
}

export function ringColorForHatchDate(hatchStr) {
  const d = parseISO(hatchStr);
  return d ? fciRingColorForDate(d) : null;
}

export function yearFromRing(ringValue) {
  if (!ringValue) return null;
  const s = normalizeDigits(String(ringValue)).trim();
  const matches = [...s.matchAll(/(?<!\d)(\d{4})(?!\d)/g)];
  if (!matches.length) return null;
  const year = parseInt(matches[matches.length - 1][1], 10);
  return year >= 1900 && year <= 2200 ? year : null;
}

export function ringColorForAncestorRing(ringValue) {
  const y = yearFromRing(ringValue);
  return y === null ? null : fciRingColorForYear(y);
}

export function formatRingDisplay(ringNumber, hatchDate) {
  const ring = String(ringNumber || "").trim();
  if (!ring) return "";
  const d = parseISO(hatchDate);
  return d ? `${ring}-${d.getFullYear()}` : ring;
}

// ---------- CSV ----------
export function parseCsv(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const delim =
    (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length
      ? ";" : ",";
  const rows = [];
  let row = [], cur = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === delim) { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      rows.push(row); row = [];
    } else cur += c;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

export function toCsv(rows) {
  const q = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return rows.map((r) => r.map(q).join(",")).join("\r\n") + "\r\n";
}

export const CSV_COL_MAP = {
  "رقم الحجل": "ring_number", ring_number: "ring_number", ring: "ring_number",
  "لون الحجل": "ring_color", ring_color: "ring_color",
  "الاسم": "name", name: "name",
  "الجنس": "gender", gender: "gender",
  "اللون": "color", "لون الريش": "color", color: "color",
  "السلالة": "strain", strain: "strain",
  "تاريخ البيضة": "egg_date", egg_date: "egg_date",
  "تاريخ وضع البيضة": "egg_date",
  "تاريخ الفقس": "hatch_date", hatch_date: "hatch_date",
  "الأب": "father_ring", father_ring: "father_ring",
  "الأم": "mother_ring", mother_ring: "mother_ring",
  "جد الأب": "p_paternal_gfather", p_paternal_gfather: "p_paternal_gfather",
  "جدة الأب": "p_paternal_gmother", p_paternal_gmother: "p_paternal_gmother",
  "جد الأم": "m_maternal_gfather", m_maternal_gfather: "m_maternal_gfather",
  "جدة الأم": "m_maternal_gmother", m_maternal_gmother: "m_maternal_gmother",
  "الملاحظات": "notes", notes: "notes",
  "رقم العش / القفص": "nest_box", "رقم العش": "nest_box", nest_box: "nest_box",
  "نتيجة السباق / الإنجازات": "race_results", "نتيجة السباق": "race_results",
  race_results: "race_results",
  "اسم المربي / اللوفت": "loft_name", "اسم المربي": "loft_name",
  loft_name: "loft_name",
};

export const PIGEON_KEYS = [
  "ring_number", "ring_color", "name", "gender", "color", "strain",
  "egg_date", "hatch_date", "father_ring", "mother_ring",
  "p_paternal_gfather", "p_paternal_gmother",
  "m_maternal_gfather", "m_maternal_gmother", "notes",
  "nest_box", "race_results", "loft_name",
];

export const CSV_EXPORT_HEADER = [
  "ID", "رقم الحجل", "لون الحجل", "الاسم", "الجنس", "لون الريش", "السلالة",
  "تاريخ البيضة", "تاريخ الفقس", "الأب", "الأم", "الملاحظات",
  "رقم العش / القفص", "نتيجة السباق / الإنجازات", "اسم المربي / اللوفت",
];

export const CSV_EXPORT_KEYS = [
  "id", "ring_number", "ring_color", "name", "gender", "color", "strain",
  "egg_date", "hatch_date", "father_ring", "mother_ring", "notes",
  "nest_box", "race_results", "loft_name",
];

/** يحوّل صفوف CSV إلى سجلات. يرجع {parsed, errors, fatal}. */
export function csvRowsToPigeons(allRows) {
  if (!allRows.length) return { parsed: [], errors: [], fatal: "الملف فارغ." };
  const header = allRows[0].map((h) => h.replace(/^﻿/, "").trim());
  const mapped = header.map((h) => CSV_COL_MAP[h]);
  if (!mapped.includes("ring_number") && !mapped.includes("name")) {
    return {
      parsed: [], errors: [],
      fatal: "الملف لا يحتوي على عمود 'رقم الحجل' أو 'الاسم'.\n" +
        "تأكد من وجود رؤوس أعمدة صحيحة (استخدم ملف تصدير كقالب).",
    };
  }
  const parsed = [], errors = [];
  allRows.slice(1).forEach((row, i) => {
    const line = i + 2;
    if (!row.some((c) => String(c).trim())) return;
    const item = Object.fromEntries(PIGEON_KEYS.map((k) => [k, ""]));
    header.forEach((h, ci) => {
      const field = CSV_COL_MAP[h];
      if (field && ci < row.length) {
        item[field] = cleanText(normalizeDigits(row[ci])) || "";
      }
    });
    if (!item.ring_color) {
      item.ring_color =
        ringColorForHatchDate(item.hatch_date) || fciRingColorForDate();
    }
    if (["egg_date", "hatch_date"].some((k) => item[k] && !validateDate(item[k]))) {
      errors.push(`صف ${line}: تاريخ غير صحيح — تم تخطيه`);
      return;
    }
    item.egg_date = normalizeDate(item.egg_date);
    item.hatch_date = normalizeDate(item.hatch_date);
    if (!item.ring_number && !item.name) {
      errors.push(`صف ${line}: لا رقم حجل ولا اسم — تم تخطيه`);
      return;
    }
    parsed.push(item);
  });
  return { parsed, errors, fatal: null };
}
