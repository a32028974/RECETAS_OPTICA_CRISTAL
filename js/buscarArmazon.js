// js/buscarArmazon.js
import { API_URL, withParams, apiGet } from './api.js';

/**
 * Arma un detalle legible combinando columnas disponibles:
 * MARCA + MODELO + ARMAZON + COLOR. Si no hay nada, usa 'detalle' del backend.
 */
function buildDetalle(item) {
  const partes = [
    (item.marca  || '').toString().trim(),
    (item.modelo || '').toString().trim(),
    (item.armazon|| '').toString().trim(),
    (item.color  || '').toString().trim(),
  ].filter(Boolean);

  const combo = partes.join(' ').replace(/\s+/g, ' ').trim();
  const fallback = (item.detalle || '').toString().trim();

  return combo || fallback;
}

/**
 * Busca el armazón y completa detalle + precio.
 * - Acepta códigos alfanuméricos (RB1130, VO979, 13336, 13-336, etc.).
 * - Si hay varios resultados, muestra un selector para elegir.
 * - Mantiene la firma: (nInput, detalleInput, precioInput)
 */
export async function buscarArmazonPorNumero(nInput, detalleInput, precioInput) {
  const raw  = String(nInput?.value || '').trim();
  const code = raw.toUpperCase().replace(/\s+/g, ''); // normalizamos pero NO quitamos letras

  // Limpia si está vacío
  if (!code) {
    if (detalleInput) detalleInput.value = '';
    if (precioInput)  precioInput.value  = '';
    return;
  }

  // Helper de "no encontrado"
  const notFound = (c) => {
    if (detalleInput) detalleInput.value = '';
    if (precioInput)  {
      precioInput.value  = '';
      // asegura que el total/saldo se recalculen si estaban en otro valor
      precioInput.dispatchEvent(new Event('input',  { bubbles:true }));
      precioInput.dispatchEvent(new Event('change', { bubbles:true }));
    }
    if (window.Swal) Swal.fire('No encontrado', `No se encontró el armazón "${c}".`, 'warning');
  };

  try {
    // Loader (si hay SweetAlert disponible)
    if (window.Swal) {
      Swal.fire({
        title: 'Buscando armazón…',
        text: `Código: ${code}`,
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });
    }

    // Flags:
    // - Si hay letras o guión, buscamos "exacto" (RB11330 ≠ 11330)
    // - Si es solo numérico, permitimos varios (multi) para que elijas
    const hasAlphaOrHyphen = /[A-Za-z-]/.test(code);
    const url = withParams(API_URL, {
      buscarArmazon: code,
      exacto: hasAlphaOrHyphen ? 1 : 0,
      multi:  hasAlphaOrHyphen ? 0 : 1
    });

    const res = await apiGet(url);
    if (window.Swal) Swal.close();

    let item = null;

    if (Array.isArray(res)) {
      if (res.length === 0) return notFound(code);

      if (res.length === 1) {
        item = res[0];
      } else if (window.Swal) {
        // Hay varios: pedir selección
        const options = {};
        res.forEach((r, i) => {
          const det = buildDetalle(r);
          const p   = r.precio ? ` — $${r.precio}` : '';
          const est = r.estado ? ` — ${r.estado}` : '';
          options[i] = `${r.codigo}${det ? ' — ' + det : ''}${p}${est}`;
        });

        const { value: idx, isConfirmed } = await Swal.fire({
          title: 'Elegí el armazón',
          input: 'select',
          inputOptions: options,
          inputPlaceholder: 'Seleccionar',
          showCancelButton: true,
          confirmButtonText: 'Usar',
          cancelButtonText: 'Cancelar'
        });

        if (!isConfirmed) return; // usuario canceló
        item = res[parseInt(idx, 10)];
      } else {
        // Sin Swal: tomar el primero como fallback
        item = res[0];
      }
    } else {
      item = res; // objeto único
    }

    if (!item) return notFound(code);

    // Completar campos con el nuevo detalle combinado
    const detalle = buildDetalle(item);
    const precioNum = (item.precio || '').toString().replace(/[^\d]/g, ''); // deja solo dígitos

    if (detalleInput) detalleInput.value = detalle;
    if (precioInput)  {
      precioInput.value  = precioNum;
      // Recalcular Total/Saldo inmediatamente
      precioInput.dispatchEvent(new Event('input',  { bubbles:true }));
      precioInput.dispatchEvent(new Event('change', { bubbles:true }));
    }

    // Si el backend nos devolvió el código normalizado, lo dejamos escrito
    if (nInput && item.codigo) nInput.value = String(item.codigo).toUpperCase();
  } catch (err) {
    console.error('buscarArmazonPorNumero:', err);
    if (window.Swal) Swal.close();
    notFound(code);
  }
}
