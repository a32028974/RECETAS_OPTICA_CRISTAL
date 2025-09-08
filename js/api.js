// js/api.js
// 1) ENDPOINT GENERAL (DNI, ARMAZÓN, HISTORIAL, setPdf)
export const API_URL  = "https://script.google.com/macros/s/AKfycbw9hmr8FjoB4Q2z_SF8QnVjMqMBx2pieZIEtLj9QrZwut1rOkf4L7Ac8TxOMYMD9Jz2UQ/exec";

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
