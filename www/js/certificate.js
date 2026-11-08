// شهادات النسب: بناء HTML لكل فرخ ثم تحويلها إلى PDF (صفحة لكل فرخ).
import * as U from "./utils.js";

const esc = U.escapeHtml;

export function ancestorRingHtml(ringValue, fallback = "---") {
  if (!ringValue) return `<span>${esc(fallback)}</span>`;
  const ring = String(ringValue).trim();
  const color = U.ringColorForAncestorRing(ring);
  if (color) {
    const hex = U.ringColorHex(color);
    const fg = U.contrastFg(hex);
    return (
      `<span style="display:inline-block;padding:3px 8px;background:${hex};` +
      `color:${fg};border:1px solid #333;border-radius:3px;font-weight:bold;">` +
      `${esc(ring)}</span>`
    );
  }
  return `<bdi>${esc(ring)}</bdi>`;
}

/** photoUri: data URI لصورة هذا الفرخ فقط، أو null. */
export function certificateInnerHtml(p, photoUri) {
  const ringDisplay = U.formatRingDisplay(p.ring_number, p.hatch_date) || "بدون حجل";
  const ringHex = U.ringColorHex(p.ring_color || "");
  const ringFg = U.contrastFg(ringHex);
  const val = (x) => esc(x || "-");
  const loft = p.loft_name || "";
  const subtitle =
    "نظام إدارة وترقيم الحمام المحلي" + (loft ? ` - ${esc(loft)}` : "");
  const photoHtml = photoUri
    ? `<img src="${photoUri}" alt="صورة الحمامة">`
    : `<span class="no-photo">لا توجد صورة</span>`;

  return `
<div class="certificate">
<h2>🏆 شهادة نسب رسمية (PEDIGREE CERTIFICATE) 🏆</h2>
<div class="subtitle">${subtitle}</div>
<div class="grid">
  <div>
    <div class="box gfather"><div class="box-title">جد الأب</div><div>${ancestorRingHtml(p.p_paternal_gfather)}</div></div><br>
    <div class="box gfather"><div class="box-title">جدة الأب</div><div>${ancestorRingHtml(p.p_paternal_gmother)}</div></div><br>
    <div class="box gfather" style="background:#e8f5e9"><div class="box-title">جد الأم</div><div>${ancestorRingHtml(p.m_maternal_gfather)}</div></div><br>
    <div class="box gfather" style="background:#e8f5e9"><div class="box-title">جدة الأم</div><div>${ancestorRingHtml(p.m_maternal_gmother)}</div></div>
  </div>
  <div>
    <div class="box father" style="height:110px;display:flex;flex-direction:column;justify-content:center">
      <div class="box-title">الأب</div>
      <div style="font-size:15px;margin-top:5px">${ancestorRingHtml(p.father_ring, "غير متوفر")}</div>
    </div><br><br>
    <div class="box mother" style="height:110px;display:flex;flex-direction:column;justify-content:center">
      <div class="box-title">الأم</div>
      <div style="font-size:15px;margin-top:5px">${ancestorRingHtml(p.mother_ring, "غير متوفر")}</div>
    </div>
  </div>
  <div>
    <div class="box target" style="height:auto;">
      <div class="pigeon-photo">${photoHtml}</div>
      <div style="color:${ringFg}; background-color:${ringHex}; padding:6px; text-align:center; border-radius:3px; font-size:15px; font-weight:bold;">
        ${esc(ringDisplay)}
      </div>
      <hr>
      <p><strong>الاسم:</strong> ${val(p.name)}</p>
      <p><strong>الجنس:</strong> ${val(p.gender)}</p>
      <p><strong>لون الريش:</strong> ${val(p.color)}</p>
      <p><strong>السلالة:</strong> ${val(p.strain)}</p>
      <p><strong>العش / القفص:</strong> ${val(p.nest_box)}</p>
      <p><strong>تاريخ الفقس:</strong> ${val(p.hatch_date)}</p>
      <p><strong>إنجازات/سباقات:</strong> ${val(p.race_results)}</p>
      <p><strong>المربي / اللوفت:</strong> ${val(p.loft_name)}</p>
      <p><strong>ملاحظات:</strong> ${val(p.notes)}</p>
    </div>
  </div>
</div>
</div>`;
}

export const CERT_CSS = `
.cert-root { width: 1000px; box-sizing: border-box; padding: 20px;
  background: #ffffff; color: #333; direction: rtl;
  font-family: system-ui, 'Noto Sans Arabic', 'Noto Naskh Arabic', Tahoma, Arial, sans-serif; }
.cert-root * { box-sizing: border-box; }
.cert-root .certificate { width: 960px; margin: 0 auto; background: #fff;
  border: 5px double #b78103; padding: 30px; }
.cert-root h2 { text-align: center; color: #b78103; margin: 0 0 5px; font-size: 24px; }
.cert-root .subtitle { text-align: center; color: #666; font-size: 14px; margin-bottom: 25px; }
.cert-root .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-top: 20px; }
.cert-root .box { padding: 12px; border-radius: 6px; border: 1px solid #ccc; font-size: 13px; }
.cert-root .box-title { font-weight: bold; font-size: 12px; margin-bottom: 5px; color: #444;
  border-bottom: 1px solid rgba(0,0,0,0.1); padding-bottom: 3px; }
.cert-root .gfather { background-color: #e3f2fd; }
.cert-root .father { background-color: #bbdefb; font-weight: bold; }
.cert-root .mother { background-color: #c8e6c9; font-weight: bold; }
.cert-root .target { background-color: #fff9c4; border: 2px solid #f57f17; }
.cert-root .target p { margin: 6px 0; }
.cert-root .pigeon-photo { height: 180px; margin-bottom: 8px; background: #fff;
  border: 1px dashed #bbb; border-radius: 4px; display: flex; align-items: center;
  justify-content: center; overflow: hidden; }
.cert-root .pigeon-photo img { max-width: 100%; max-height: 100%; }
.cert-root .no-photo { color: #999; font-size: 13px; }
`;

function loadImages(root) {
  return Promise.all(
    [...root.querySelectorAll("img")].map((img) =>
      img.complete ? Promise.resolve() :
        new Promise((r) => { img.onload = img.onerror = () => r(); })),
  );
}

/**
 * items: [{ p: سجل الفرخ, photoUri: data URI | null }]
 * يرجع {base64, count}. كل فرخ في صفحته الخاصة بصورته فقط.
 */
export async function buildCertificatesPdf(items, onProgress) {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF || !window.html2canvas) {
    throw new Error("مكتبات إنشاء PDF غير محمّلة.");
  }
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = 297, pageH = 210, margin = 8;

  const host = document.createElement("div");
  host.style.cssText =
    "position:fixed;top:0;left:0;z-index:-1;pointer-events:none;";
  const style = document.createElement("style");
  style.textContent = CERT_CSS;
  host.appendChild(style);
  document.body.appendChild(host);

  try {
    for (let i = 0; i < items.length; i++) {
      onProgress && onProgress(i + 1, items.length);
      const page = document.createElement("div");
      page.className = "cert-root";
      page.innerHTML = certificateInnerHtml(items[i].p, items[i].photoUri);
      host.appendChild(page);
      await loadImages(page);
      await new Promise((r) => setTimeout(r, 30));

      const canvas = await window.html2canvas(page, {
        scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false,
      });
      host.removeChild(page);

      let w = pageW - margin * 2;
      let h = (w * canvas.height) / canvas.width;
      if (h > pageH - margin * 2) {
        h = pageH - margin * 2;
        w = (h * canvas.width) / canvas.height;
      }
      if (i > 0) pdf.addPage("a4", "landscape");
      pdf.addImage(
        canvas.toDataURL("image/jpeg", 0.92), "JPEG",
        (pageW - w) / 2, margin, w, h,
      );
    }
  } finally {
    host.remove();
  }
  const base64 = pdf.output("datauristring").split(",")[1];
  return { base64, count: items.length };
}
