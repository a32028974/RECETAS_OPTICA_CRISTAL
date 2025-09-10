// js/api.js
// 1) ENDPOINT GENERAL (DNI, ARMAZÓN, HISTORIAL, setPdf)
export const API_URL  = "https://script.google.com/macros/s/AKfycbzLhu4WEkyN0VlTWSxVPz2IE8aKggZWYTsOht1iB7c-d3uAe69cmBz6gwGVD--tJl1PMA/exec";

// 2) ENDPOINT DE PACK/TELEGRAM (el tuyo que ya funcionaba)
export const PACK_URL = "https://script.google.com/macros/s/AKfycbyAc51qga-xnN3319jcVmAWwz7NTlNH-Lht3IwRIt8PT0MAy_ZKpcGJiohQZIFPfIONsA/exec";

// Helpers comunes
export function withParams(base, params = {}) {
  const u = new URL(base);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, v);
  });
  return u.toString();
}

export async function apiGet(url) {
  const r = await fetch(url, { method: 'GET', cache: 'no-store' });
  if (!r.ok) {
    const txt = await r.text().catch(()=> '');
    throw new Error(`HTTP ${r.status} – ${txt.slice(0,200)}`);
  }
  return r.json();
}
