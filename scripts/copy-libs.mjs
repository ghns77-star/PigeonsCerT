// ينسخ مكتبتي html2canvas و jsPDF من node_modules إلى www/lib
// (تُستخدمان لإنشاء شهادات PDF داخل التطبيق دون إنترنت).
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const libDir = join(root, "www", "lib");
mkdirSync(libDir, { recursive: true });

const files = [
  ["node_modules/html2canvas/dist/html2canvas.min.js", "html2canvas.min.js"],
  ["node_modules/jspdf/dist/jspdf.umd.min.js", "jspdf.umd.min.js"],
];

let ok = true;
for (const [src, name] of files) {
  const from = join(root, src);
  if (!existsSync(from)) {
    console.error("ملف غير موجود:", from);
    ok = false;
    continue;
  }
  copyFileSync(from, join(libDir, name));
  console.log("copied", name);
}
if (!ok) process.exit(1);
