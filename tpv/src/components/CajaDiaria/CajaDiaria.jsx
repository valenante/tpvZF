import React, { useState, useEffect } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { obtenerCajasPorRango } from "./ObtenerCajasPorRango";

// Registrar componentes necesarios de Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const GraficoCajaDiaria = () => {
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [datos, setDatos] = useState([]);
  const [error, setError] = useState(null);

  // Calcular fechas predeterminadas: primer día del mes actual y hoy
  useEffect(() => {
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const finMes = hoy; // Fecha actual

    setFechaInicio(inicioMes.toISOString().split("T")[0]);
    setFechaFin(finMes.toISOString().split("T")[0]);

    manejarRango(inicioMes.toISOString().split("T")[0], finMes.toISOString().split("T")[0]);
  }, []);

  // Función para manejar la obtención de datos por rango
  const manejarRango = async (inicio, fin) => {
    try {
      const cajas = await obtenerCajasPorRango(inicio, fin);
      setDatos(cajas || []); // Asegúrate de establecer un array
      setError(null);
    } catch (err) {
      console.error("Error al obtener las cajas:", err);
      setDatos([]); // Reestablece un array vacío en caso de error
      setError("No se pudieron cargar los datos.");
    }
  };

  const manejarCambioDeRango = () => {
    manejarRango(fechaInicio, fechaFin);
  };

  const data = {
    labels: Array.isArray(datos) ? datos.map((caja) => new Date(caja.fecha).toLocaleDateString()) : [],
    datasets: [
      {
        label: "Total de Caja (€)", // Etiqueta con símbolo de euro
        data: Array.isArray(datos) ? datos.map((caja) => caja.total) : [],
        borderColor: "rgba(75, 192, 192, 1)",
        backgroundColor: "rgba(75, 192, 192, 0.2)",
        tension: 0.4,
      },
    ],
  };

  return (
    <div>
      <h1>Gráfico de Caja Diaria</h1>
      <div>
        <label>Fecha Inicio:</label>
        <input
          type="date"
          value={fechaInicio}
          onChange={(e) => setFechaInicio(e.target.value)}
        />
        <label>Fecha Fin:</label>
        <input
          type="date"
          value={fechaFin}
          onChange={(e) => setFechaFin(e.target.value)}
        />
        <button onClick={manejarCambioDeRango}>Actualizar Gráfico</button>
      </div>
      {error && <p>{error}</p>}
      {Array.isArray(datos) && datos.length === 0 && !error && <p>No hay datos para mostrar.</p>}
      {Array.isArray(datos) && datos.length > 0 && (
        <Line key={JSON.stringify(datos)} data={data} />
      )}
    </div>
  );
};

export default GraficoCajaDiaria;