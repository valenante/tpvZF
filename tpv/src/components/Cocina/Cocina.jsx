import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import io from 'socket.io-client'
import PedidosFinalizados from './PedidosFinalizados';
import './Cocina.css';

// Conectar al servidor de Socket.io
const socket = io(process.env.REACT_APP_SOCKET_URL);

const Cocina = () => {
  const [pedidos, setPedidos] = useState([]);
  const [mostrarFinalizados, setMostrarFinalizados] = useState(false);

  // Función para calcular tiempo transcurrido
  const calcularTiempoTranscurrido = (fecha) => {
    const ahora = new Date();
    const fechaPedido = new Date(fecha);
    const diferencia = Math.floor((ahora - fechaPedido) / 60000); // Diferencia en minutos
    return `${diferencia}m`;
  };

  // Función para cargar pedidos pendientes
  const cargarPedidos = async () => {
    try {
      // Agregamos el tipo como query parameter
      const response = await api.get('/pedidos/pendientes/pendientes', {
        params: { tipo: 'plato' }, // Aquí especificamos que queremos solo los platos
      });
      console.log('Pedidos pendientes (platos):', response.data);
      setPedidos(response.data);
    } catch (error) {
      console.error('Error al cargar pedidos:', error);
    }
  };

  // Escuchar evento nuevoPedido y recargar pedidos de platos
  useEffect(() => {
    socket.on('nuevoPedido', () => {
      cargarPedidos(); // Recargar solo los pedidos de platos
    });

    // Cleanup del evento para evitar duplicados
    return () => {
      socket.off('nuevoPedido');
    };
  }, []);

  // Marcar un producto como listo
  const marcarProductoComoListo = async (pedidoId, productoId) => {
    try {
      await api.put(`/pedidos/${pedidoId}/producto/${productoId}`, { estadoPreparacion: 'listo' });
      cargarPedidos(); // Recargar la lista de pedidos de platos
    } catch (error) {
      console.error('Error al marcar producto como listo:', error);
    }
  };


  // Marcar el pedido entero como listo
  const marcarPedidoComoListo = async (pedidoId) => {
    try {
      await api.put(`/pedidos/${pedidoId}`, { estado: 'listo' });
      console.log(pedidos)
      cargarPedidos(); // Recargar la lista de pedidos
    } catch (error) {
      console.error('Error al marcar pedido como listo:', error);
    }
  };

  useEffect(() => {
    cargarPedidos();
    const interval = setInterval(cargarPedidos, 30000); // Actualizar cada 30 segundos
    return () => clearInterval(interval); // Limpiar intervalo al desmontar
  }, []);

  return (
    <div className="cocina--cocina">
      <h1 className="titulo--cocina">Pedidos Pendientes</h1>
      <button
        onClick={() => setMostrarFinalizados(true)}
        className="boton-finalizados--cocina"
      >
        Ver Pedidos Finalizados
      </button>
      {mostrarFinalizados && (
        <PedidosFinalizados onClose={() => setMostrarFinalizados(false)} />
      )}
      {pedidos.length === 0 ? (
        <p className="mensaje-vacio--cocina">No hay pedidos pendientes</p>
      ) : (
        <div className="pedidos-container--cocina">
          {pedidos.map((pedido) => {
            const todosProductosListos = pedido.productos
              .filter((producto) => ["plato", "tapaRacion"].includes(producto.tipo))
              .every((producto) => producto.estadoPreparacion === "listo");
  
            return (
              <div key={pedido._id} className="pedido-card--cocina">
                <div className="pedido-header--cocina">
                  <h3>Mesa {pedido.mesa.numero}</h3>
                  <p>Comensales: {pedido.comensales}</p>
                  {pedido.alergias && <p className="alergias--cocina">Alergias: {pedido.alergias}</p>}
                </div>
                <p>
                <strong>Hace:</strong> {calcularTiempoTranscurrido(pedido.fecha)}
              </p>
                <ul className="productos-list--cocina">
                  {pedido.productos
                    .filter((producto) => ["plato", "tapaRacion"].includes(producto.tipo))
                    .map((producto) => (
                      <li key={producto._id} className="producto-item--cocina">
                        <label>
                          <input
                            type="checkbox"
                            checked={producto.estadoPreparacion === "listo"}
                            onChange={() =>
                              marcarProductoComoListo(pedido._id, producto._id)
                            }
                          />
                          {producto.cantidad}x {producto.producto?.nombre || "Producto no disponible"}
                        </label>
                        {producto.ingredientesEliminados.length > 0 && (
                          <p>
                            <strong>Sin:</strong> {producto.ingredientesEliminados.join(", ")}
                          </p>
                        )}
                        {producto.especificaciones.length > 0 && (
                          <p>
                            <strong>Especificaciones:</strong> {producto.especificaciones.join(", ")}
                          </p>
                        )}
                      </li>
                    ))}
                </ul>
                <button
                  onClick={() => marcarPedidoComoListo(pedido._id)}
                  disabled={!todosProductosListos}
                  className="boton-terminar--cocina"
                >
                  Terminar Pedido
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};  

export default Cocina;