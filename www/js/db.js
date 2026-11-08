// طبقة التخزين: IndexedDB داخل التطبيق (تعمل بدون إنترنت).
// المخازن: pigeons, treatments, photos (صورة كل فرخ مرتبطة بمعرّفه).

const DB_NAME = "pigeons_app";
const VERSION = 1;
let dbPromise = null;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const r = indexedDB.open(DB_NAME, VERSION);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains("pigeons")) {
          db.createObjectStore("pigeons", { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains("treatments")) {
          db.createObjectStore("treatments", { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains("photos")) {
          db.createObjectStore("photos", { keyPath: "id" });
        }
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  return dbPromise;
}

const req = (r) =>
  new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

async function run(stores, mode, fn) {
  const db = await open();
  const t = db.transaction(stores, mode);
  const done = new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
  const result = await fn(t);
  await done;
  return result;
}

// ---------- الفروخ ----------
export const getPigeons = () =>
  run("pigeons", "readonly", (t) => req(t.objectStore("pigeons").getAll()));

export const getPigeon = (id) =>
  run("pigeons", "readonly", (t) => req(t.objectStore("pigeons").get(id)));

export const addPigeon = (rec) =>
  run("pigeons", "readwrite", (t) => {
    const { id, ...rest } = rec;
    return req(t.objectStore("pigeons").add(rest));
  });

export const addPigeons = (list) =>
  run("pigeons", "readwrite", (t) => {
    const s = t.objectStore("pigeons");
    list.forEach(({ id, ...rest }) => s.add(rest));
    return list.length;
  });

export const updatePigeon = (id, rec) =>
  run("pigeons", "readwrite", (t) =>
    req(t.objectStore("pigeons").put({ ...rec, id })));

export const deletePigeons = (ids) =>
  run(["pigeons", "photos"], "readwrite", (t) => {
    ids.forEach((id) => {
      t.objectStore("pigeons").delete(id);
      t.objectStore("photos").delete(id);
    });
  });

// ---------- الصور ----------
export const getPhoto = (id) =>
  run("photos", "readonly", async (t) => {
    const r = await req(t.objectStore("photos").get(id));
    return r ? r.blob : null;
  });

export const getPhotoIds = () =>
  run("photos", "readonly", (t) => req(t.objectStore("photos").getAllKeys()));

export const setPhoto = (id, blob) =>
  run("photos", "readwrite", (t) => {
    const s = t.objectStore("photos");
    if (blob) s.put({ id, blob });
    else s.delete(id);
  });

// ---------- العلاجات ----------
export const getTreatments = () =>
  run("treatments", "readonly", (t) => req(t.objectStore("treatments").getAll()));

export const getTreatment = (id) =>
  run("treatments", "readonly", (t) => req(t.objectStore("treatments").get(id)));

export const addTreatment = (rec) =>
  run("treatments", "readwrite", (t) => {
    const { id, ...rest } = rec;
    return req(t.objectStore("treatments").add(rest));
  });

export const updateTreatment = (id, rec) =>
  run("treatments", "readwrite", (t) =>
    req(t.objectStore("treatments").put({ ...rec, id })));

export const deleteTreatment = (id) =>
  run("treatments", "readwrite", (t) => {
    t.objectStore("treatments").delete(id);
  });

// ---------- نسخ احتياطي / استعادة ----------
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}

export async function exportAll() {
  const [pigeons, treatments] = await Promise.all([getPigeons(), getTreatments()]);
  const photoRows = await run("photos", "readonly", (t) =>
    req(t.objectStore("photos").getAll()));
  const photos = {};
  for (const r of photoRows) photos[r.id] = await blobToDataUrl(r.blob);
  return { version: 1, exported_at: new Date().toISOString(), pigeons, treatments, photos };
}

export async function replaceAll(data) {
  const photoBlobs = [];
  for (const [id, url] of Object.entries(data.photos || {})) {
    const blob = await (await fetch(url)).blob();
    photoBlobs.push({ id: Number(id), blob });
  }
  await run(["pigeons", "treatments", "photos"], "readwrite", (t) => {
    const ps = t.objectStore("pigeons"), ts = t.objectStore("treatments"),
      fs = t.objectStore("photos");
    ps.clear(); ts.clear(); fs.clear();
    (data.pigeons || []).forEach((p) => ps.put(p));
    (data.treatments || []).forEach((x) => ts.put(x));
    photoBlobs.forEach((p) => fs.put(p));
  });
  return {
    pigeons: (data.pigeons || []).length,
    treatments: (data.treatments || []).length,
  };
}
