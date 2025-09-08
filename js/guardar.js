// /js/guardar.js — v2025-09-05 (N° único con sufijos -1, -2… + PDF/Telegram)
// Requiere: api.js (API_URL, PACK_URL, withParams, apiGet) y que print.js defina window.__buildPrintArea()

import { API_URL, PACK_URL, withParams, apiGet } from "./api.js";

/* ===== Helpers DOM/valores ===== */
const $ = (id) => document.getElementById(id);
const V = (id) => (document.getElementById(id)?.value ?? "").toString().trim();
const U = (v) => (v ?? "").toString().trim().toUpperCase();

/* ===== Networking helpers ===== */
async function postForm(url, bodyParams, { timeoutMs = 30000 } = {}) {
  const body = bodyParams instanceof URLSearchParams
    ? bodyParams
    : new URLSearchParams(bodyParams || {});
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort("timeout"), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body,
      signal: ctrl.signal
    });
    const txt = await res.text();
    let data = null; try { data = JSON.parse(txt); } catch {}
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}: ${txt.slice(0,200)}`);
    return data ?? txt;
  } catch (e) {
    const msg = (e?.name === "AbortError" || e?.message === "timeout")
      ? "Tiempo de espera agotado (no respondió el servidor)"
      : /Failed to fetch|TypeError|NetworkError/i.test(String(e?.message || e))
        ? "No se pudo conectar al servidor (revisá la URL / permisos del Web App de Apps Script)"
        : e?.message || "Error de red";
    throw new Error(msg);
  } finally {
    clearTimeout(to);
  }
}

/* ===== Otros helpers ===== */
function setNumeroTrabajo(n) {
  const vis = $("numero_trabajo");
  if (vis) vis.value = (n ?? "").toString().trim();
  const hid = $("numero_trabajo_hidden");
  if (hid) hid.value = (n ?? "").toString().trim();
}
function syncNumeroTrabajoHidden() {
  const vis = $("numero_trabajo");
  const hid = $("numero_trabajo_hidden");
  if (vis && hid) hid.value = vis.value.trim();
}
function entregaLabel() {
  const sel = document.getElementById("entrega-select");
  return sel?.options[sel.selectedIndex]?.text || "Stock (7 días)";
}
function fotosBase64() {
  const a = Array.isArray(window.__FOTOS) ? window.__FOTOS : [];
  return a.map((d) => (d.split(",")[1] || "").trim()).filter(Boolean);
}
function resumenPack() {
  const money = (v) => (v ? `$ ${v}` : "");
  return {
    "Fecha": V("fecha"),
    "Retira (estimada)": V("fecha_retira"),
    "N° trabajo": V("numero_trabajo"),
    "DNI": V("dni"),
    "Cliente": V("nombre"),
    "Teléfono": V("telefono"),
    "DR (oculista)": V("dr"),
    "Cristal": `${V("cristal")} ${money(V("precio_cristal"))}`,
    "Obra social": `${V("obra_social")} ${money(V("importe_obra_social"))}`,
    "Armazón": `${V("numero_armazon")} ${V("armazon_detalle")} ${money(V("precio_armazon"))}`,
    "Otro": `${V("otro_concepto")} ${money(V("precio_otro"))}`,
    "Distancia focal": V("distancia_focal"),
    "OD": `ESF ${V("od_esf")}  |  CIL ${V("od_cil")}  |  EJE ${V("od_eje")}`,
    "OI": `ESF ${V("oi_esf")}  |  CIL ${V("oi_cil")}  |  EJE ${V("oi_eje")}`,
    "DNP (OD/OI)": V("dnp"),
    "ADD": V("add"),
    "TOTAL": money(V("total")),
    "SEÑA": money(V("sena")),
    "SALDO": money(V("saldo")),
    "Vendedor": V("vendedor"),
    "Forma de pago": V("forma_pago"),
    "Entrega": entregaLabel()
  };
}

/* ===== NÚMERO ÚNICO: buscar duplicados y asignar sufijo ===== */

// query “histBuscar” flexible (devuelve [] si falla)
async function _queryHist(params) {
  try {
    const url = withParams(API_URL, params);
    const data = await apiGet(url);
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

// extrae un número de trabajo de un row
function _extractNro(row) {
  return String(
    row?.numero ?? row?.num ?? row?.nro ?? row?.n_trabajo ?? row?.NRO ?? row?.N ?? ""
  ).trim();
}

// toma “12345-2” -> { base:"12345", suf:2 }
function _splitBaseSuf(nro) {
  const m = String(nro || "").trim().match(/^(.+?)(?:-([0-9]+))?$/);
  return { base: (m?.[1] ?? "").trim(), suf: Number(m?.[2] ?? 0) || 0 };
}

// calcula el siguiente disponible: 12345, 12345-1, 12345-2, …
function _nextDisponible(base, listaUsados) {
  const usados = new Set(listaUsados);
  if (!usados.has(base)) return base;
  let i = 1;
  while (usados.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

// Busca números ya usados que empiecen con la base
async function _obtenerNumeroDisponible(nroDeseado) {
  const { base } = _splitBaseSuf(nroDeseado);

  // 1) búsqueda exacta por número usando @ (tu backend lo entiende así)
  let rows = await _queryHist({ histBuscar: `@${base}`, limit: 200 });

  // 2) fallback si el 1) no trajo nada
  if (!rows.length) {
    rows = await _queryHist({ histBuscar: base, limit: 200 });
  }

  const usados = rows
    .map(_extractNro)
    .filter(n => n && (n === base || n.startsWith(base + "-")));

  const candidato = _nextDisponible(base, usados);
  return candidato;
}

/* ===== Flujo principal ===== */
export async function guardarTrabajo({ progress } = {}) {
  const spinner = $("spinner");
  const setStep = (label, status = "done") => { try { progress?.mark?.(label, status); } catch {} };

  try {
    if (spinner) spinner.style.display = "block";

    // Sincronizar hidden (si existe)
    syncNumeroTrabajoHidden();

    // Validaciones mínimas
    setStep("Validando datos", "run");
    const nroInput = V("numero_trabajo");
    if (!nroInput) throw new Error("Ingresá el número de trabajo");
    if (!V("dni")) throw new Error("Ingresá el DNI");
    if (!V("nombre")) throw new Error("Ingresá el nombre");
    setStep("Validando datos", "done");

    // ======== N° ÚNICO (client-side) ========
    setStep("Validando número", "run");
    let nroFinalCliente = nroInput;
    try {
      const sugerido = await _obtenerNumeroDisponible(nroInput);
      if (sugerido && sugerido !== nroInput) {
        nroFinalCliente = sugerido;
        setNumeroTrabajo(sugerido);
        if (window.Swal) {
          Swal.fire({
            toast:true, position:'top', timer:1600, showConfirmButton:false,
            icon:'info', title:`N° ocupado. Se usará ${sugerido}`
          });
        }
      }
    } catch { /* si falla, seguimos con el ingresado */ }
    setStep("Validando número", "done");

    // 1) Guardar en planilla (POST)
    setStep("Guardando en planilla", "run");
    const formEl = $("formulario");
    if (!formEl) throw new Error("Formulario no encontrado");

    const fd = new FormData(formEl);
    const body = new URLSearchParams(fd);

    // Forzamos el número final decidido del lado cliente
    body.set("numero_trabajo", nroFinalCliente);
    body.set("numero", nroFinalCliente); // alias común en GAS

    // Aliases para armazón (número/detalle) — compat con tu GAS
    const numAr = (fd.get("numero_armazon") || "").toString().trim();
    const detAr = (fd.get("armazon_detalle") || "").toString().trim();

    body.set("numero_armazon", numAr);
    body.set("n_armazon", numAr);
    body.set("num_armazon", numAr);
    body.set("nro_armazon", numAr);
    body.set("armazon_numero", numAr);
    body.set("NUMERO ARMAZON", numAr);

    body.set("armazon", detAr);
    body.set("armazon_detalle", detAr);
    body.set("detalle_armazon", detAr);
    body.set("ARMAZON", detAr);

    const postJson = await postForm(API_URL, body);
    setStep("Guardando en planilla", "done");

    // Número definitivo que pudo devolver el backend (por colisiones simultáneas)
    const numeroFinal = (postJson && postJson.numero_trabajo)
      ? String(postJson.numero_trabajo).trim()
      : nroFinalCliente;
    setNumeroTrabajo(numeroFinal);

    // 2) PACK (PDF + Telegram)
    setStep("Generando PDF", "run");
    const payload = {
      numero_trabajo: numeroFinal,
      dni: V("dni"),
      nombre: U(V("nombre")),
      resumen: resumenPack(),
      imagenesBase64: fotosBase64()
    };

    const j = await postForm(PACK_URL, new URLSearchParams({
      genPack: "1",
      payload: JSON.stringify(payload)
    }));
    if (!j?.ok) throw new Error("No se pudo crear/enviar el PDF");
    const packUrl = j.url || j.pdf || "";
    setStep("Generando PDF", "done");

    // Guardar link del PDF
    const hidden = $("pack_url");
    if (hidden) hidden.value = packUrl;
    if (packUrl) {
      setStep("Guardando link del PDF", "run");
      try {
        const setUrl = withParams(API_URL, { setPdf: 1, numero: numeroFinal, url: packUrl });
        await apiGet(setUrl);
      } catch (e) {
        console.warn("No se pudo actualizar la columna PDF:", e?.message || e);
      }
      setStep("Guardando link del PDF", "done");
    }

    // 3) Confirmar + imprimir (opcional)
    try { progress?.doneAndHide?.(0); } catch {}
    if (spinner) spinner.style.display = "none";

    let imprimir = true;
    if (window.Swal) {
      const r = await Swal.fire({
        title: "Guardado y PDF enviado",
        text: "¿Imprimir ahora?",
        icon: "success",
        showCancelButton: true,
        confirmButtonText: "Imprimir",
        cancelButtonText: "Cerrar"
      });
      imprimir = r.isConfirmed;
    } else {
      imprimir = confirm("Guardado y PDF enviado.\n¿Imprimir ahora?");
    }

    if (imprimir) {
      // Tu print.js arma el ticket leyendo del formulario
      if (typeof window.__buildPrintArea === 'function') {
        window.__buildPrintArea();
      }
    }

    return { ok: true, numero_trabajo: numeroFinal, pdf: packUrl };

  } catch (err) {
    try { progress?.fail?.(err?.message || "Error al guardar"); } catch {}
    if (window.Swal) Swal.fire("Error", err?.message || "Error inesperado", "error");
    throw err;
  } finally {
    if ($("spinner")) $("spinner").style.display = "none";
  }
}
