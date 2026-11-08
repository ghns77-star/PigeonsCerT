import assert from "node:assert/strict";
import * as U from "../www/js/utils.js";

const d = (s) => U.parseISO(s);

// ألوان الحجل (آخر 3 أشهر تُحسب للسنة التالية)
assert.equal(U.fciRingColorForDate(d("2026-05-01")), "أزرق FCI");
assert.equal(U.fciRingColorForDate(d("2026-09-30")), "أزرق FCI");
assert.equal(U.fciRingColorForDate(d("2026-10-01")), "أحمر فاتح FCI");
assert.equal(U.fciRingColorForDate(d("2027-01-15")), "أحمر فاتح FCI");
assert.equal(U.fciRingColorForDate(d("2030-03-01")), "أبيض FCI");
assert.equal(U.fciRingColorForDate(d("2031-03-01")), "أزرق FCI");
assert.equal(U.fciRingColorForYear(2025), "أبيض FCI"); // قبل سنة البداية
assert.equal(U.ringColorForHatchDate("2026-12-31"), "أحمر فاتح FCI");
assert.equal(U.ringColorForHatchDate("bad"), null);

// التواريخ
assert.equal(U.expectedHatchDate("2026-01-20"), "2026-02-07");
assert.equal(U.expectedHatchDate("2026-02-20"), "2026-03-10");
assert.equal(U.validateDate("2026-02-30"), false);
assert.equal(U.validateDate(""), true);
assert.equal(U.normalizeDate("2026-5-1"), "2026-05-01");
assert.equal(U.daysUntil("2026-11-10", new Date(2026, 10, 8)), 2);
assert.equal(U.daysUntil("2026-11-01", new Date(2026, 10, 8)), -7);

// أرقام عربية / حجل
assert.equal(U.normalizeDigits("٢٠٢٦-۰۵"), "2026-05");
assert.equal(U.yearFromRing("1234-2027"), 2027);
assert.equal(U.yearFromRing("1234/2027"), 2027);
assert.equal(U.yearFromRing("12345"), null);
assert.equal(U.ringColorForAncestorRing("55-2027"), "أحمر فاتح FCI");
assert.equal(U.formatRingDisplay("77", "2026-04-02"), "77-2026");
assert.equal(U.formatRingDisplay("77", ""), "77");
assert.equal(U.formatRingDisplay("", "2026-04-02"), "");
assert.equal(U.contrastFg("#FFFFFF"), "#000000");
assert.equal(U.contrastFg("#111111"), "#FFFFFF");
assert.equal(U.ringColorHex("أبيض"), "#FFFFFF");

// CSV: ذهاب وإياب مع فواصل وأسطر داخل الحقول
const rows = [["a", "b,c", 'd"e'], ["x\ny", "", "z"]];
assert.deepEqual(U.parseCsv(U.toCsv(rows)), rows);
assert.deepEqual(U.parseCsv("a;b\r\n1;2\r\n"), [["a", "b"], ["1", "2"]]);

// استيراد CSV
const csv = U.parseCsv(
  "رقم الحجل,الاسم,تاريخ الفقس,تاريخ البيضة\n" +
  "١٢٣,نجم,2026-05-02,\n" +      // أرقام عربية
  ",,,\n" +                        // صف فارغ
  "9,سيئ,2026-13-01,\n" +          // تاريخ غير صحيح
  ",,2026-01-01,\n");              // لا حجل ولا اسم
const r = U.csvRowsToPigeons(csv);
assert.equal(r.fatal, null);
assert.equal(r.parsed.length, 1);
assert.equal(r.parsed[0].ring_number, "123");
assert.equal(r.parsed[0].ring_color, "أزرق FCI");
assert.equal(r.errors.length, 2);
assert.ok(U.csvRowsToPigeons([["x", "y"]]).fatal);
assert.ok(U.csvRowsToPigeons([]).fatal);

console.log("utils tests passed");
