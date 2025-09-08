// js/buscarNombre.js
import { API_URL, withParams, apiGet } from './api.js';

/**
 * Completa nombre y teléfono a partir del DNI.
 * Muestra un SweetAlert de "Buscando…" bloqueando la pantalla.
 *
 * @param {HTMLInputElement} dniEl       input #dni
 * @param {HTMLInputElement} nombreEl    input #nombre
 * @param {HTMLInputElement} telefonoEl  input #telefono
 * @param {HTMLElement}      indicatorEl (opcional) icono/spinner junto al DNI
 */
export async function buscarNombrePorDNI(dniEl, nombreEl, telefonoEl, indicatorEl) {
  const dni = String(dniEl?.value || '').replace(/\D+/g, '');
  if (!dni) {
    if (nombreEl)   nombreEl.value   = '';
    if (telefonoEl) telefonoEl.value = '';
    return null;
  }

  // Loader bloqueante
  if (window.Swal) {
    Swal.fire({
      title: 'Buscando…',
      text: `Consultando historial del cliente (DNI ${dni})`,
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => Swal.showLoading(),
      backdrop: true,
    });
  }
  if (indicatorEl) indicatorEl.style.visibility = 'visible';

  try {
    const url  = withParams(API_URL, { buscarDNI: dni, json: 1 });
    const data = await apiGet(url);

    const nombre   = (data?.nombre   || '').toUpperCase().trim();
    const telefono = (data?.telefono || '').trim();

    if (nombreEl)   nombreEl.value   = nombre;   // siempre completa
    if (telefonoEl) {
      telefonoEl.value = telefono;              // siempre completa
      // Disparamos change para que main.js regenere el número de trabajo
      telefonoEl.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // (Opcional) Si no hay datos, podríamos avisar con un toast:
    // if (!nombre && !telefono && window.Swal) Swal.fire('Sin coincidencias', 'No se encontró cliente para ese DNI.', 'info');

    return data;
  } catch (err) {
    console.error('buscarNombrePorDNI:', err);
    if (nombreEl)   nombreEl.value   = '';
    if (telefonoEl) telefonoEl.value = '';
    return null;
  } finally {
    if (indicatorEl) indicatorEl.style.visibility = 'hidden';
    if (window.Swal) Swal.close();
  }
}
