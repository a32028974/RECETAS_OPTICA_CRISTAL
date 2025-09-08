// calculos.js
export function configurarCalculoPrecios() {
  const precioCristal = document.getElementById("precio_cristal");
  const precioArmazon = document.getElementById("precio_armazon");
  const precioOtro = document.getElementById("precio_otro");
  const totalInput = document.getElementById("total");
  const senaInput = document.getElementById("sena");
  const saldoInput = document.getElementById("saldo");

  function actualizarTotalYSaldo() {
    const cristal = parseFloat(precioCristal.value) || 0;
    const armazon = parseFloat(precioArmazon.value) || 0;
    const otro = parseFloat(precioOtro.value) || 0;
    const sena = parseFloat(senaInput.value) || 0;

    const total = cristal + armazon + otro;
    totalInput.value = total.toFixed(2);

    const saldo = total - sena;
    saldoInput.value = saldo.toFixed(2);
  }

  [precioCristal, precioArmazon, precioOtro, senaInput].forEach(input => {
    input.addEventListener("input", actualizarTotalYSaldo);
  });
}
