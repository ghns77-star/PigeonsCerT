import * as U from "./utils.js";
import * as DB from "./db.js";
import { saveAndShare, safeFilename } from "./native.js";
import { buildCertificatesPdf, ancestorRingHtml } from "./certificate.js";

const $ = (s, r = document) => r.querySelector(s);
const esc = U.escapeHtml;
// bdi: يمنع اختلاط اتجاه الأرقام/الشرطات مع النص العربي (مثل 55-2027)
const bd = (x) => `<bdi>${esc(x)}</bdi>`;

/* =====================================================================
   حالة التطبيق
   ===================================================================== */
const SEARCH_FIELDS = [
  ["رقم الحجل", "ring_number"], ["اسم الفرخ", "name"],
  ["رقم حجل الأب", "father_ring"], ["رقم حجل الأم", "mother_ring"],
  ["جد الأب", "p_paternal_gfather"], ["جدة الأب", "p_paternal_gmother"],
  ["جد الأم", "m_maternal_gfather"], ["جدة الأم", "m_maternal_gmother"],
];

const SORT_FIELDS = [
  ["الترتيب: الإضافة", "id"], ["رقم الحجل", "ring_number"],
  ["لون الحجل", "ring_color"], ["الاسم", "name"], ["الجنس", "gender"],
  ["لون الريش", "color"], ["السلالة", "strain"],
  ["تاريخ وضع البيضة", "egg_date"], ["تاريخ الفقس", "hatch_date"],
  ["الأب", "father_ring"], ["الأم", "mother_ring"], ["الملاحظات", "notes"],
];

const ADV_FIELDS = [
  ["رقم الحجل", "ring_number"], ["لون الحجل", "ring_color"],
  ["اسم الحجل/الفرخ", "name"], ["الجنس", "gender"], ["لون الريش", "color"],
  ["السلالة", "strain"], ["تاريخ وضع البيضة", "egg_date"],
  ["تاريخ الفقس", "hatch_date"], ["رقم حجل الأب", "father_ring"],
  ["رقم حجل الأم", "mother_ring"], ["جد الأب", "p_paternal_gfather"],
  ["جدة الأب", "p_paternal_gmother"], ["جد الأم", "m_maternal_gfather"],
  ["جدة الأم", "m_maternal_gmother"], ["صندوق العش", "nest_box"],
  ["نتائج السباقات", "race_results"], ["اسم اللوفت", "loft_name"],
  ["ملاحظات", "notes"],
];
// البحث باسم الأب/الأم/الأجداد عبر رقم الحجل المرتبط بسجل الطائر نفسه
const ADV_RELATED = [
  ["اسم الأب", "father_ring"], ["اسم الأم", "mother_ring"],
  ["اسم جد الأب", "p_paternal_gfather"], ["اسم جدة الأب", "p_paternal_gmother"],
  ["اسم جد الأم", "m_maternal_gfather"], ["اسم جدة الأم", "m_maternal_gmother"],
];

const state = {
  all: [],
  photoIds: new Set(),
  selected: new Set(),
  sort: { key: "id", reverse: false },
  filter: null, // {type:'basic',field,keyword} | {type:'adv',criteria:[[field,value,related]]}
  tab: "pigeons",
  treatments: [],
};

/* =====================================================================
   أدوات الواجهة
   ===================================================================== */
function toast(msg, ms = 2600) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), ms);
}

function busy(msg) {
  $("#busyMsg").textContent = msg || "";
  $("#busy").hidden = false;
  return {
    set: (m) => ($("#busyMsg").textContent = m),
    done: () => ($("#busy").hidden = true),
  };
}

const sheets = [];
function openSheet(title, bodyEl, opts = {}) {
  const el = document.createElement("div");
  el.className = "sheet";
  el.style.zIndex = String(100 + sheets.length);
  el.innerHTML =
    `<div class="sheet-head"><button class="icon-btn" data-close aria-label="إغلاق">✕</button>` +
    `<h2>${esc(title)}</h2></div><div class="sheet-body"></div>`;
  $(".sheet-body", el).appendChild(bodyEl);
  $("#sheetRoot").appendChild(el);
  const api = {
    el,
    close() {
      const i = sheets.indexOf(api);
      if (i >= 0) sheets.splice(i, 1);
      el.remove();
      if (opts.onClose) opts.onClose();
    },
  };
  $("[data-close]", el).onclick = api.close;
  sheets.push(api);
  return api;
}

function openMenu(title, items) {
  const body = document.createElement("div");
  body.className = "menu-list";
  const sh = openSheet(title, body);
  items.forEach(([label, fn]) => {
    const b = document.createElement("button");
    b.className = "btn";
    b.textContent = label;
    b.onclick = () => { sh.close(); fn(); };
    body.appendChild(b);
  });
}

function pickFile(accept) {
  return new Promise((resolve) => {
    const inp = $("#filePicker");
    inp.value = "";
    inp.accept = accept || "";
    inp.onchange = () => resolve(inp.files && inp.files[0] ? inp.files[0] : null);
    inp.click();
  });
}

/* =====================================================================
   الفروخ: تحميل، تصفية، ترتيب، عرض
   ===================================================================== */
async function loadPigeons() {
  state.all = await DB.getPigeons();
  state.photoIds = new Set(await DB.getPhotoIds());
  state.selected.clear();
  renderPigeons();
}

function filteredRows() {
  const f = state.filter;
  let rows = state.all;
  if (f && f.type === "basic") {
    const kw = U.normalizeDigits(f.keyword).toLowerCase();
    rows = rows.filter((p) => String(p[f.field] ?? "").toLowerCase().includes(kw));
  } else if (f && f.type === "adv") {
    const namesByRing = new Map();
    state.all.forEach((p) => {
      if (p.ring_number) {
        if (!namesByRing.has(p.ring_number)) namesByRing.set(p.ring_number, []);
        namesByRing.get(p.ring_number).push(String(p.name || "").toLowerCase());
      }
    });
    rows = rows.filter((p) =>
      f.criteria.every(([field, val, related]) =>
        related
          ? (namesByRing.get(p[field]) || []).some((n) => n.includes(val))
          : String(p[field] ?? "").toLowerCase().includes(val)));
  }
  const { key, reverse } = state.sort;
  const sorted = [...rows].sort((a, b) => {
    if (key === "id") return a.id - b.id;
    const va = String(a[key] ?? "").toLowerCase();
    const vb = String(b[key] ?? "").toLowerCase();
    return va < vb ? -1 : va > vb ? 1 : 0;
  });
  return reverse ? sorted.reverse() : sorted;
}

function renderPigeons() {
  const rows = filteredRows();
  const list = $("#pigeonList");
  $("#countLine").textContent =
    `عدد الفروخ: ${rows.length}` +
    (rows.length !== state.all.length ? ` من ${state.all.length}` : "");

  if (!rows.length) {
    list.innerHTML = `<div class="empty">${
      state.all.length ? "لا توجد نتائج مطابقة." : "لا توجد فروخ بعد. اضغط ＋ لإضافة أول فرخ."
    }</div>`;
  } else {
    list.innerHTML = rows.map((p) => {
      const hex = U.ringColorHex(p.ring_color);
      const sel = state.selected.has(p.id) ? " selected" : "";
      const dates = [
        p.egg_date ? `🥚 ${bd(p.egg_date)}` : "",
        p.hatch_date ? `🐣 ${bd(p.hatch_date)}` : "",
      ].filter(Boolean).join("  ");
      const meta = [p.gender, p.color, p.strain].filter(Boolean).map(esc).join(" • ");
      const parents = [
        p.father_ring ? `الأب: ${bd(p.father_ring)}` : "",
        p.mother_ring ? `الأم: ${bd(p.mother_ring)}` : "",
      ].filter(Boolean).join("   ");
      return `<article class="card${sel}" data-id="${p.id}">
        <span class="box"></span>
        <span class="swatch" style="background:${hex}"></span>
        <div class="info">
          <div class="l1"><b>${bd(p.ring_number || "[بدون حجل]")}</b>
            <span class="nm">${esc(p.name || "")}</span></div>
          ${meta ? `<div class="m">${meta}</div>` : ""}
          ${dates ? `<div class="m">${dates}</div>` : ""}
          ${parents ? `<div class="m">${parents}</div>` : ""}
          ${p.notes ? `<div class="m">📝 ${esc(p.notes)}</div>` : ""}
        </div>
        ${state.photoIds.has(p.id) ? '<span class="cam">📷</span>' : ""}
      </article>`;
    }).join("");
  }
  updateSelUI();
  updateFilterBanner();
  $("#sortDir").textContent = state.sort.reverse ? "▼" : "▲";
}

function updateFilterBanner() {
  const f = state.filter;
  const b = $("#filterBanner");
  if (f && f.type === "adv") {
    b.hidden = false;
    $("#filterText").textContent = `بحث متقدم نشط (${f.criteria.length} معايير)`;
  } else b.hidden = true;
}

function updateSelUI() {
  const n = state.selected.size;
  $("#selbar").hidden = n === 0 || state.tab !== "pigeons";
  $("#selCount").textContent = `${n} محدد`;
  $("#fab").hidden = (state.tab === "pigeons" && n > 0);
}

function toggleSelect(id) {
  if (state.selected.has(id)) state.selected.delete(id);
  else state.selected.add(id);
  const el = $(`#pigeonList .card[data-id="${id}"]`);
  if (el) el.classList.toggle("selected", state.selected.has(id));
  updateSelUI();
}

function orderedSelectedIds() {
  return filteredRows().map((p) => p.id).filter((id) => state.selected.has(id));
}

/* =====================================================================
   نموذج الفرخ (إضافة / تعديل / نسخ)
   ===================================================================== */
const FORM_FIELDS = [
  ["اسم الحمام/الفرخ أو التعريف", "name", "text"],
  ["الجنس (ذكر/أنثى)", "gender", "gender"],
  ["لون الريش", "color", "text"],
  ["السلالة", "strain", "text"],
  ["تاريخ وضع البيضة", "egg_date", "date"],
  ["تاريخ الفقس", "hatch_date", "date"],
  ["رقم حجل الأب", "father_ring", "text"],
  ["رقم حجل الأم", "mother_ring", "text"],
  ["جد الأب (Paternal G-Father)", "p_paternal_gfather", "text"],
  ["جدة الأب (Paternal G-Mother)", "p_paternal_gmother", "text"],
  ["جد الأم (Maternal G-Father)", "m_maternal_gfather", "text"],
  ["جدة الأم (Maternal G-Mother)", "m_maternal_gmother", "text"],
  ["ملاحظات خاصة بالفرخ", "notes", "area"],
  ["رقم العش / القفص", "nest_box", "text"],
  ["نتيجة السباق / الإنجازات", "race_results", "text"],
  ["اسم المربي / اللوفت", "loft_name", "text"],
];

/** تصغير الصورة (أقصى بعد 1200px) وتحويلها إلى JPEG لتقليل حجم التخزين. */
async function resizeImage(file, maxDim = 1200, quality = 0.85) {
  let bmp;
  if (window.createImageBitmap) {
    bmp = await createImageBitmap(file);
  } else {
    bmp = await new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error("bad image"));
      img.src = URL.createObjectURL(file);
    });
  }
  const w = bmp.width, h = bmp.height;
  const scale = Math.min(1, maxDim / Math.max(w, h));
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(w * scale));
  cv.height = Math.max(1, Math.round(h * scale));
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.drawImage(bmp, 0, 0, cv.width, cv.height);
  if (bmp.close) bmp.close();
  return new Promise((res, rej) =>
    cv.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), "image/jpeg", quality));
}

function openColorPicker(current, onPick) {
  const body = document.createElement("div");
  body.innerHTML =
    `<input type="search" id="palSearch" placeholder="🔍 بحث عن لون" style="width:100%">` +
    `<div class="palette-grid" id="palGrid"></div>`;
  const sh = openSheet("اختيار لون الحجل", body);
  const grid = $("#palGrid", body);
  const render = (q = "") => {
    grid.innerHTML = U.RING_COLOR_PALETTE
      .filter(([n]) => n.toLowerCase().includes(q.toLowerCase()))
      .map(([n, c]) =>
        `<button type="button" class="chip" data-n="${esc(n)}"><i style="background:${c}"></i>${esc(n)}</button>`)
      .join("");
  };
  render();
  $("#palSearch", body).oninput = (e) => render(e.target.value);
  grid.onclick = (e) => {
    const b = e.target.closest(".chip");
    if (!b) return;
    onPick(b.dataset.n);
    sh.close();
  };
}

async function openPigeonForm(mode, pid = null) {
  let rec = {};
  let photoBlob = null, photoChanged = false, photoUrl = null;
  if (mode !== "add") {
    rec = await DB.getPigeon(pid);
    if (!rec) return;
    // عند النسخ يبدأ السجل الجديد بدون صورة حتى لا تتكرر صورة فرخ على آخر
    if (mode === "edit") photoBlob = await DB.getPhoto(pid);
  }
  const val = (k) => esc(mode === "copy" && k === "ring_number" ? "" : rec[k] ?? "");

  let ringColor = rec.ring_color || U.fciRingColorForDate();
  let hatchManual = Boolean(rec.hatch_date);
  let ringColorManual = false;
  if (mode !== "add") {
    const exp = U.ringColorForHatchDate(rec.hatch_date);
    if (exp && ringColor !== exp) ringColorManual = true;
  }

  const form = document.createElement("form");
  form.className = "form";
  form.autocomplete = "off";
  const fieldHtml = FORM_FIELDS.map(([label, key, type]) => {
    let input;
    if (type === "date") input = `<input type="date" name="${key}" value="${val(key)}">`;
    else if (type === "area") input = `<textarea name="${key}">${val(key)}</textarea>`;
    else if (type === "gender")
      input = `<input name="${key}" list="genderList" value="${val(key)}">` +
        `<datalist id="genderList"><option value="ذكر"><option value="أنثى"></datalist>`;
    else input = `<input name="${key}" value="${val(key)}">`;
    return `<label class="lbl">${label}</label>${input}`;
  }).join("");

  form.innerHTML = `
    <label class="lbl">رقم الحجل</label>
    <input name="ring_number" value="${val("ring_number")}">
    <div class="ring-row">
      <span>لون الحجل:</span>
      <button type="button" class="color-btn" id="ringBtn"><span class="sw"></span><span class="nm"></span><span>▼</span></button>
      <button type="button" class="btn small" id="ringReset" title="إعادة اللون التلقائي">🔄</button>
    </div>
    ${fieldHtml}
    <label class="lbl">صورة الحمامة (اختياري)</label>
    <div class="photo-prev" id="photoPrev"></div>
    <div class="ring-row">
      <button type="button" class="btn purple small" id="photoPick">🖼 اختيار صورة الحمامة...</button>
      <button type="button" class="btn small" id="photoClear">✖ حذف الصورة</button>
    </div>
    <div class="hint">تُحفظ الصورة مع سجل هذا الفرخ وتظهر في شهادته فقط.</div>
    <div class="actions">
      <button type="submit" class="btn primary">${mode === "edit" ? "حفظ التعديلات" : "حفظ البيانات"}</button>
    </div>`;

  const sheet = openSheet(
    { add: "إضافة فرخ جديد", edit: "تعديل بيانات فرخ",
      copy: "نسخ فرخ (سجل جديد بنفس البيانات)" }[mode],
    form,
    { onClose: () => { if (photoUrl) URL.revokeObjectURL(photoUrl); } },
  );

  const f = (name) => form.elements[name];

  // ---- لون الحجل ----
  const paintRing = () => {
    $(".sw", form).style.background = U.ringColorHex(ringColor);
    $(".nm", form).textContent = ringColor;
  };
  const setRingColor = (name, manual) => {
    ringColor = name;
    if (manual) ringColorManual = true;
    paintRing();
  };
  const updateRingFromHatch = () => {
    if (ringColorManual) return;
    const c = U.ringColorForHatchDate(f("hatch_date").value);
    if (c) setRingColor(c, false);
  };
  paintRing();
  $("#ringBtn", form).onclick = () =>
    openColorPicker(ringColor, (n) => setRingColor(n, true));
  $("#ringReset", form).onclick = () => {
    ringColorManual = false;
    setRingColor(U.fciRingColorForDate(), false);
    updateRingFromHatch();
  };

  // ---- ربط التواريخ ----
  const autoHatch = () => {
    if (!hatchManual) {
      const exp = U.expectedHatchDate(f("egg_date").value);
      if (exp && f("hatch_date").value !== exp) f("hatch_date").value = exp;
    }
    updateRingFromHatch();
  };
  f("egg_date").addEventListener("input", autoHatch);
  f("egg_date").addEventListener("change", autoHatch);
  const onHatch = () => { hatchManual = true; updateRingFromHatch(); };
  f("hatch_date").addEventListener("input", onHatch);
  f("hatch_date").addEventListener("change", onHatch);

  // ---- الصورة ----
  const prev = $("#photoPrev", form);
  const renderPhoto = () => {
    if (photoUrl) { URL.revokeObjectURL(photoUrl); photoUrl = null; }
    if (photoBlob) {
      photoUrl = URL.createObjectURL(photoBlob);
      prev.innerHTML = `<img src="${photoUrl}" alt="">`;
    } else prev.textContent = "لا توجد صورة";
  };
  renderPhoto();
  $("#photoPick", form).onclick = async () => {
    const file = await pickFile("image/*");
    if (!file) return;
    try {
      photoBlob = await resizeImage(file);
      photoChanged = true;
      renderPhoto();
    } catch {
      toast("الملف ليس صورة مدعومة.");
    }
  };
  $("#photoClear", form).onclick = () => {
    photoBlob = null; photoChanged = true; renderPhoto();
  };

  // ---- الحفظ ----
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = {};
    for (const key of U.PIGEON_KEYS) {
      if (key === "ring_color") continue;
      data[key] = U.cleanText(U.normalizeDigits(f(key).value)) || "";
    }
    data.egg_date = U.normalizeDate(data.egg_date);
    data.hatch_date = U.normalizeDate(data.hatch_date);
    if (!Object.values(data).some(Boolean) && !photoBlob) {
      alert("أدخل بياناً واحداً على الأقل قبل الحفظ.");
      return;
    }
    data.ring_color = ringColor;
    try {
      if (mode === "edit") {
        await DB.updatePigeon(pid, data);
        if (photoChanged) await DB.setPhoto(pid, photoBlob);
      } else {
        const id = await DB.addPigeon(data);
        if (photoBlob) await DB.setPhoto(id, photoBlob);
      }
    } catch (err) {
      alert("تعذّر الحفظ: " + err);
      return;
    }
    sheet.close();
    await loadPigeons();
    toast("تم الحفظ");
  });
}

/* =====================================================================
   البحث المتقدم
   ===================================================================== */
function openAdvancedSearch() {
  const options = [
    ["— اختر الحقل —", ""], ...ADV_FIELDS,
    ...ADV_RELATED.map(([l, k]) => [l, "rel:" + k]),
  ];
  const body = document.createElement("div");
  body.innerHTML = `
    <p class="hint" style="font-size:13px">أدخل معيارين أو أكثر. يمكن كتابة جزء من القيمة فقط؛
    مثلاً 26 في تاريخ الفقس أو نال في اسم الأم. ستُطبّق المعايير المحددة جميعاً.</p>
    <div id="advRows"></div>
    <div class="form"><div class="actions">
      <button type="button" class="btn small" id="advAdd">＋ معيار</button>
      <button type="button" class="btn primary" id="advRun">تنفيذ البحث</button>
    </div></div>`;
  const sh = openSheet("البحث المتقدم عن الحجل", body);
  const rowsEl = $("#advRows", body);
  const optHtml = options
    .map(([l, k]) => `<option value="${esc(k)}">${esc(l)}</option>`).join("");
  const addRow = () => {
    const r = document.createElement("div");
    r.className = "adv-row";
    r.innerHTML = `<select>${optHtml}</select><input placeholder="القيمة (كاملة أو جزء منها)">`;
    rowsEl.appendChild(r);
  };
  addRow(); addRow();
  $("#advAdd", body).onclick = addRow;

  $("#advRun", body).onclick = () => {
    const criteria = [];
    const used = new Set();
    for (const r of rowsEl.children) {
      const sel = $("select", r);
      const rawField = sel.value;
      const field = rawField.replace(/^rel:/, "");
      const related = rawField.startsWith("rel:");
      const label = sel.options[sel.selectedIndex].text;
      const value = U.cleanText(U.normalizeDigits($("input", r).value)) || "";
      if (!field && !value) continue;
      if (value && !field) { alert("اختر الحقل المقابل لكل قيمة مدخلة."); return; }
      if (field && !value) continue;
      if (used.has(label)) { alert("اختر حقلاً مختلفاً لكل معيار؛ لا تكرر الحقل نفسه."); return; }
      used.add(label);
      criteria.push([field, value.toLowerCase(), related]);
    }
    if (criteria.length < 2) {
      alert("أدخل معيارين على الأقل لإجراء البحث المتقدم.");
      return;
    }
    $("#searchInput").value = "";
    state.filter = { type: "adv", criteria };
    state.selected.clear();
    sh.close();
    renderPigeons();
  };
}

/* =====================================================================
   شجرة النسب
   ===================================================================== */
async function showPedigree(pid) {
  const p = await DB.getPigeon(pid);
  if (!p) return;
  const blob = await DB.getPhoto(pid);
  const url = blob ? URL.createObjectURL(blob) : null;

  const ringDisplay = U.formatRingDisplay(p.ring_number, p.hatch_date) || "بدون حجل بعد";
  const hex = U.ringColorHex(p.ring_color || "");
  const box = (title, ring, rows, fb = "---") =>
    `<div class="tbox" style="grid-column:1;grid-row:${rows}"><h4>${title}</h4>${ancestorRingHtml(ring, fb)}</div>`;
  const parent = (title, ring, rows) =>
    `<div class="tbox" style="grid-column:2;grid-row:${rows}"><h4>${title}</h4>` +
    `<div style="font-weight:700;margin-top:6px">${ancestorRingHtml(ring, "غير متوفر")}</div></div>`;

  const body = document.createElement("div");
  body.innerHTML = `<div class="tree">
    ${box("جد الأب (P.G-Father)", p.p_paternal_gfather, "1 / span 2")}
    ${box("جدة الأب (P.G-Mother)", p.p_paternal_gmother, "3 / span 2")}
    ${box("جد الأم (M.G-Father)", p.m_maternal_gfather, "5 / span 2")}
    ${box("جدة الأم (M.G-Mother)", p.m_maternal_gmother, "7 / span 2")}
    ${parent("الأب (Father)", p.father_ring, "1 / span 4")}
    ${parent("الأم (Mother)", p.mother_ring, "5 / span 4")}
    <div class="tbox cur">
      <div class="tree-photo">${url ? `<img src="${url}" alt="">` : "لا توجد صورة"}</div>
      <div class="tree-ring" style="background:${hex};color:${U.contrastFg(hex)}">${esc(ringDisplay)}</div>
      <p><b>الاسم:</b> ${esc(p.name || "-")}</p>
      <p><b>الجنس:</b> ${esc(p.gender || "-")} | <b>لون الريش:</b> ${esc(p.color || "-")}</p>
      <p><b>السلالة:</b> ${esc(p.strain || "-")}</p>
      <p><b>تاريخ الفقس:</b> ${bd(p.hatch_date || "-")}</p>
      <p><b>ملاحظات:</b> ${esc(p.notes || "-")}</p>
    </div></div>`;
  openSheet(`شجرة النسب - ${p.ring_number || p.name || ""}`, body, {
    onClose: () => { if (url) URL.revokeObjectURL(url); },
  });
}

/* =====================================================================
   شهادة النسب (PDF)
   ===================================================================== */
function blobToDataUri(blob) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = () => rej(fr.error);
    fr.readAsDataURL(blob);
  });
}

async function printCertificates() {
  const ids = orderedSelectedIds();
  if (!ids.length) { alert("يرجى تحديد فرخ واحد على الأقل لطباعة شهادة النسب!"); return; }
  const b = busy("جارٍ إنشاء الشهادة…");
  try {
    const items = [];
    for (const id of ids) {
      const p = await DB.getPigeon(id);
      if (!p) continue;
      // صورة هذا الفرخ فقط، تُقرأ من سجله بمعرّفه
      const blob = await DB.getPhoto(id);
      items.push({ p, photoUri: blob ? await blobToDataUri(blob) : null });
    }
    if (!items.length) { alert("لم يتم العثور على بيانات الفروخ المحددة."); return; }
    const { base64, count } = await buildCertificatesPdf(
      items, (i, n) => b.set(`جارٍ إنشاء الشهادة ${i} من ${n}…`));
    const filename = count === 1
      ? safeFilename(`Certificate_${U.formatRingDisplay(items[0].p.ring_number, items[0].p.hatch_date) || "بدون_حجل"}.pdf`)
      : `Certificates_${count}_pigeons_${stamp()}.pdf`;
    b.done();
    await saveAndShare({
      filename, data: base64, isBase64: true, mime: "application/pdf",
      title: count === 1 ? "شهادة نسب" : `شهادات نسب (${count} فروخ)`,
    });
  } catch (err) {
    alert("تعذّر إنشاء الشهادة: " + (err && err.message ? err.message : err));
  } finally {
    b.done();
  }
}

const stamp = () => {
  const d = new Date(), p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};

/* =====================================================================
   تصدير / استيراد CSV ونسخ احتياطي
   ===================================================================== */
async function exportCsv() {
  const rows = await DB.getPigeons();
  if (!rows.length) { alert("لا توجد بيانات للتصدير."); return; }
  const out = [U.CSV_EXPORT_HEADER, ...rows.map((p) => U.CSV_EXPORT_KEYS.map((k) => p[k] ?? ""))];
  try {
    await saveAndShare({
      filename: `pigeons_${stamp()}.csv`, data: U.toCsv(out),
      mime: "text/csv;charset=utf-8", bom: true, title: "تصدير الفروخ CSV",
    });
  } catch (err) { alert("فشل التصدير: " + err); }
}

async function importCsv() {
  const file = await pickFile(".csv,text/csv,text/plain,*/*");
  if (!file) return;
  let allRows;
  try {
    const buf = await file.arrayBuffer();
    let text;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(buf); }
    catch { text = new TextDecoder("windows-1256").decode(buf); }
    allRows = U.parseCsv(text.replace(/^﻿/, ""));
  } catch (err) { alert("تعذّر قراءة الملف:\n" + err); return; }

  const { parsed, errors, fatal } = U.csvRowsToPigeons(allRows);
  if (fatal) { alert(fatal); return; }
  if (!parsed.length) {
    alert("لم يتم العثور على صفوف صالحة للاستيراد." +
      (errors.length ? "\n\n" + errors.slice(0, 10).join("\n") : ""));
    return;
  }
  if (!confirm(`سيتم استيراد ${parsed.length} صفاً إلى قاعدة البيانات.\n` +
    `صفوف تم تخطيها: ${errors.length}\n\nهل تريد المتابعة؟`)) return;
  try {
    await DB.addPigeons(parsed);
    await loadPigeons();
    toast(`تم استيراد ${parsed.length} صفاً`);
  } catch (err) { alert("فشل الاستيراد:\n" + err); }
}

async function backup() {
  const b = busy("جارٍ إنشاء النسخة الاحتياطية…");
  try {
    const data = await DB.exportAll();
    b.done();
    await saveAndShare({
      filename: `pigeons_backup_${stamp()}.json`,
      data: JSON.stringify(data), mime: "application/json",
      title: "نسخة احتياطية - إدارة الحمام",
    });
  } catch (err) { alert("فشل النسخ: " + err); }
  finally { b.done(); }
}

async function restore() {
  const file = await pickFile(".json,application/json,*/*");
  if (!file) return;
  let data;
  try {
    data = JSON.parse((await file.text()).replace(/^﻿/, ""));
    if (!data || !Array.isArray(data.pigeons)) throw new Error("ملف غير صالح");
  } catch (err) { alert("الملف ليس نسخة احتياطية صالحة:\n" + err); return; }
  if (!confirm(`سيتم استبدال كل البيانات الحالية بالنسخة الاحتياطية ` +
    `(${data.pigeons.length} فرخ، ${(data.treatments || []).length} علاج).\n\nهل تريد المتابعة؟`)) return;
  const b = busy("جارٍ استعادة البيانات…");
  try {
    await DB.replaceAll(data);
    await loadPigeons();
    await loadTreatments();
    toast("تمت الاستعادة");
  } catch (err) { alert("فشلت الاستعادة:\n" + err); }
  finally { b.done(); }
}

/* =====================================================================
   العلاجات والتطعيمات
   ===================================================================== */
async function loadTreatments() {
  state.treatments = await DB.getTreatments();
  renderTreatments();
}

function renderTreatments() {
  const list = $("#treatList");
  const rows = [...state.treatments].sort((a, b) => {
    const da = a.next_date || "9999-99-99", db = b.next_date || "9999-99-99";
    return da < db ? -1 : da > db ? 1 : 0;
  });
  if (!rows.length) {
    list.innerHTML = `<div class="empty">لا توجد علاجات. اضغط ＋ لإضافة علاج أو تطعيم.</div>`;
    return;
  }
  list.innerHTML = rows.map((t) => {
    let cls = "", status = "";
    const d = t.next_date ? U.daysUntil(t.next_date) : null;
    if (d !== null) {
      if (d < 0) { cls = "overdue"; status = `متأخر ${-d} يوم`; }
      else if (d <= 7) { cls = "soon"; status = d === 0 ? "اليوم" : `بعد ${d} يوم`; }
      else { cls = "ok"; status = `بعد ${d} يوم`; }
    }
    return `<article class="card treat ${cls}" data-id="${t.id}">
      <div class="info">
        <div class="l1"><b>${esc(t.title)}</b></div>
        ${t.target ? `<div class="m">المستهدف: ${esc(t.target)}</div>` : ""}
        <div class="m">الجرعة: ${bd(t.given_date)}${t.next_date ? `  ←  القادمة: ${bd(t.next_date)}` : ""}</div>
        ${t.notes ? `<div class="m">📝 ${esc(t.notes)}</div>` : ""}
      </div>
      ${status ? `<span class="status">${status}</span>` : ""}
    </article>`;
  }).join("");
}

async function openTreatmentForm(tid = null) {
  const rec = tid ? await DB.getTreatment(tid) : {};
  if (tid && !rec) return;
  const v = (k) => esc(rec[k] ?? "");
  const form = document.createElement("form");
  form.className = "form";
  form.autocomplete = "off";
  form.innerHTML = `
    <label class="lbl">اسم العلاج / التطعيم</label>
    <input name="title" value="${v("title")}">
    <label class="lbl">المستهدف (مثلاً: كل اللوفت / عش رقم 3)</label>
    <input name="target" value="${v("target")}">
    <label class="lbl">تاريخ إعطاء الجرعة</label>
    <input type="date" name="given_date" value="${v("given_date")}">
    <label class="lbl">تاريخ الجرعة القادمة (إن وجد)</label>
    <input type="date" name="next_date" value="${v("next_date")}">
    <label class="lbl">ملاحظات</label>
    <textarea name="notes">${v("notes")}</textarea>
    <div class="actions">
      <button type="submit" class="btn primary">حفظ</button>
      ${tid ? '<button type="button" class="btn danger" id="trDel">حذف</button>' : ""}
    </div>`;
  const sh = openSheet(tid ? "تعديل العلاج" : "إضافة علاج أو تطعيم جديد", form);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = {};
    for (const k of ["title", "target", "given_date", "next_date", "notes"]) {
      data[k] = U.cleanText(U.normalizeDigits(form.elements[k].value)) || "";
    }
    if (!data.title || !data.given_date) {
      alert("يجب إدخال اسم العلاج وتاريخ الجرعة على الأقل!");
      return;
    }
    data.given_date = U.normalizeDate(data.given_date);
    data.next_date = U.normalizeDate(data.next_date);
    if (tid) await DB.updateTreatment(tid, data);
    else await DB.addTreatment(data);
    sh.close();
    await loadTreatments();
    toast("تم الحفظ");
  });
  const del = $("#trDel", form);
  if (del) {
    del.onclick = async () => {
      if (!confirm("هل تريد حذف هذا العلاج؟")) return;
      await DB.deleteTreatment(tid);
      sh.close();
      await loadTreatments();
    };
  }
}

/* =====================================================================
   ربط الأحداث
   ===================================================================== */
function setTab(tab) {
  state.tab = tab;
  $("#tab-pigeons").hidden = tab !== "pigeons";
  $("#tab-treatments").hidden = tab !== "treatments";
  document.querySelectorAll(".tabbar button").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === tab));
  updateSelUI();
}

function applyTheme(name) {
  document.documentElement.dataset.theme = name;
  $("#themeBtn").textContent = name === "dark" ? "☀️" : "🌙";
  try { localStorage.setItem("theme", name); } catch { /* ignore */ }
}

function selectedFirst(msgNone) {
  const ids = orderedSelectedIds();
  if (!ids.length) { alert(msgNone); return null; }
  return ids;
}

function init() {
  // السمة
  let theme = "light";
  try { theme = localStorage.getItem("theme") || "light"; } catch { /* ignore */ }
  applyTheme(theme);
  $("#themeBtn").onclick = () =>
    applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");

  // قوائم الاختيار
  $("#searchField").innerHTML = SEARCH_FIELDS
    .map(([l, k]) => `<option value="${k}">${l}</option>`).join("");
  $("#sortField").innerHTML = SORT_FIELDS
    .map(([l, k]) => `<option value="${k}">${l}</option>`).join("");

  // التبويبات
  document.querySelectorAll(".tabbar button").forEach((b) =>
    (b.onclick = () => setTab(b.dataset.tab)));

  $("#fab").onclick = () =>
    state.tab === "pigeons" ? openPigeonForm("add") : openTreatmentForm();

  // البحث البسيط
  const doSearch = () => {
    const kw = $("#searchInput").value.trim();
    state.filter = kw ? { type: "basic", field: $("#searchField").value, keyword: kw } : null;
    state.selected.clear();
    renderPigeons();
  };
  $("#searchInput").addEventListener("input", doSearch);
  $("#searchField").addEventListener("change", doSearch);
  $("#advBtn").onclick = openAdvancedSearch;
  $("#filterClear").onclick = () => {
    state.filter = null;
    $("#searchInput").value = "";
    state.selected.clear();
    renderPigeons();
  };

  // الترتيب
  $("#sortField").onchange = (e) => { state.sort.key = e.target.value; renderPigeons(); };
  $("#sortDir").onclick = () => { state.sort.reverse = !state.sort.reverse; renderPigeons(); };

  // تحديد الكل
  $("#selAllBtn").onclick = () => {
    const rows = filteredRows();
    if (state.selected.size === rows.length) state.selected.clear();
    else rows.forEach((p) => state.selected.add(p.id));
    renderPigeons();
  };

  // قائمة المزيد
  $("#menuBtn").onclick = () =>
    openMenu("المزيد", [
      ["📤 تصدير CSV", exportCsv],
      ["📥 استيراد CSV", importCsv],
      ["💾 نسخة احتياطية (مع الصور)", backup],
      ["♻️ استعادة نسخة احتياطية", restore],
      ["🔄 تحديث", loadPigeons],
    ]);

  // قائمة الفروخ
  $("#pigeonList").addEventListener("click", (e) => {
    const card = e.target.closest(".card");
    if (card) toggleSelect(Number(card.dataset.id));
  });

  // شريط الإجراءات
  $("#selbar").addEventListener("click", async (e) => {
    const act = e.target.closest("button")?.dataset.act;
    if (!act) return;
    const ids = orderedSelectedIds();
    if (!ids.length) return;
    if (act === "edit") {
      if (ids.length > 1) { alert("يرجى تحديد فرخ واحد فقط للتعديل في نفس الوقت."); return; }
      openPigeonForm("edit", ids[0]);
    } else if (act === "copy") openPigeonForm("copy", ids[0]);
    else if (act === "tree") showPedigree(ids[0]);
    else if (act === "cert") printCertificates();
    else if (act === "del") {
      if (!confirm(`هل أنت متأكد من حذف الفروخ المحددة (عددها: ${ids.length})؟`)) return;
      await DB.deletePigeons(ids);
      await loadPigeons();
      toast("تم الحذف");
    }
  });

  // العلاجات
  $("#treatList").addEventListener("click", (e) => {
    const card = e.target.closest(".card");
    if (card) openTreatmentForm(Number(card.dataset.id));
  });

  // زر الرجوع في أندرويد
  const AppPlugin = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if (AppPlugin && AppPlugin.addListener) {
    AppPlugin.addListener("backButton", () => {
      if (sheets.length) sheets[sheets.length - 1].close();
      else if (state.selected.size) { state.selected.clear(); renderPigeons(); }
      else AppPlugin.exitApp();
    });
  }

  // منع حذف البيانات تلقائياً من النظام عند ضيق المساحة
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist();

  setTab("pigeons");
  loadPigeons();
  loadTreatments();
}

init();
