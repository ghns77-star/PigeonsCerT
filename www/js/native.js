// حفظ/مشاركة الملفات: على أندرويد عبر Filesystem + Share، وفي المتصفح كتنزيل عادي.

function plugins() {
  const cap = window.Capacitor;
  if (cap && typeof cap.isNativePlatform === "function" && cap.isNativePlatform()) {
    const p = cap.Plugins || {};
    if (p.Filesystem && p.Share) return p;
  }
  return null;
}

/**
 * data: نص عادي، أو Base64 إن كان isBase64 = true
 * يرجع true عند فتح نافذة المشاركة / بدء التنزيل.
 */
export async function saveAndShare({
  filename, data, mime, isBase64 = false, bom = false, title,
}) {
  const p = plugins();
  if (p) {
    const write = await p.Filesystem.writeFile({
      path: filename,
      data: isBase64 ? data : (bom ? "﻿" : "") + data,
      directory: "CACHE",
      ...(isBase64 ? {} : { encoding: "utf8" }),
    });
    await p.Share.share({
      title: title || filename,
      url: write.uri,
      dialogTitle: "حفظ أو مشاركة الملف",
    });
    return true;
  }
  // احتياطي للمتصفح
  let blob;
  if (isBase64) {
    const bin = atob(data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    blob = new Blob([bytes], { type: mime });
  } else {
    blob = new Blob([bom ? "﻿" : "", data], { type: mime });
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}

export function safeFilename(name) {
  return String(name).replace(/[\\/:*?"<>|\s]+/g, "_");
}
