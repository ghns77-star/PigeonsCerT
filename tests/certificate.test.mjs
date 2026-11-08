import assert from "node:assert/strict";
import { certificateInnerHtml } from "../www/js/certificate.js";
const a = certificateInnerHtml({ ring_number: "1", name: "أ", hatch_date: "2026-04-01", ring_color: "أزرق FCI", father_ring: "9-2027" }, "data:image/jpeg;base64,AAAA");
const b = certificateInnerHtml({ ring_number: "2", name: "<b>ب</b>" }, null);
const c = certificateInnerHtml({ ring_number: "3" }, "data:image/jpeg;base64,CCCC");
assert.ok(a.includes("base64,AAAA") && !a.includes("CCCC") && !a.includes("لا توجد صورة"));
assert.ok(b.includes("لا توجد صورة") && !b.includes("base64"));
assert.ok(c.includes("base64,CCCC") && !c.includes("AAAA"));
assert.ok(a.includes("1-2026"));                 // رقم الحجل-سنة الفقس
assert.ok(a.includes("#F58AA5"));                // لون الأب من سنة حجله 2027
assert.ok(b.includes("&lt;b&gt;"));              // تهريب HTML
console.log("certificate tests passed");
