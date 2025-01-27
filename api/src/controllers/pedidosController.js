const Mesa = require('../models/Mesa');
const Pedido = require('../models/Pedido');
const Venta = require('../models/Ventas');
const Producto = require('../models/Producto');
const Cart = require('../models/Cart');

// Crear un nuevo pedido
exports.createPedido = async (req, res) => {
    try {
        const { mesa, productos, total, comensales, alergias, pan, cartId } = req.body;

        console.log(cartId, 'este es el mamadisimo cartId');

        console.log(productos);

        // Buscar la mesa usando el ObjectId
        const mesaExistente = await Mesa.findById(mesa);

        if (!mesaExistente) {
            console.error('Mesa no encontrada');
            return res.status(404).json({ error: 'Mesa no encontrada' });
        }

        // Crear el nuevo pedido con el ObjectId de la mesa
        const nuevoPedido = new Pedido({
            productos, // Pasamos los productos directamente desde la solicitud
            total,     // Total del pedido
            comensales,
            alergias,
            pan,
            mesa: mesaExistente._id, // Asignar el ObjectId de la mesa
        });

        // Redondear el total del pedido a dos decimales
        nuevoPedido.total = parseFloat(nuevoPedido.total.toFixed(2));

        // Guardar el nuevo pedido en la base de datos
        await nuevoPedido.save();

        // Agregar el ID del nuevo pedido al campo 'pedidos' de la mesa
        mesaExistente.pedidos.push(nuevoPedido._id);

        // Sumar el total del nuevo pedido al total de la mesa
        mesaExistente.total += nuevoPedido.total;

        // Redondear el total de la mesa a dos decimales
        mesaExistente.total = parseFloat(mesaExistente.total.toFixed(2));

        // Guardar la mesa actualizada
        await mesaExistente.save();

        console.log(productos);

        // Crear ventas para cada producto del pedido
        for (const producto of productos) {
            console.log(`Procesando producto con ID ${producto._id}, cantidad: ${producto.cantidad}`);

            // Crear la venta
            const venta = new Venta({
                producto: producto.producto, // Asociamos el producto a la venta
                pedidoId: nuevoPedido._id, // Asociamos el pedido a la venta
                cantidad: producto.cantidad,
                total,
            });

            console.log('Venta a guardar:', venta);

            // Guardar la venta en la base de datos
            await venta.save();
            console.log('Venta guardada con éxito:', venta);

            // Ahora, agregar la venta directamente al producto en la colección de productos
            const productoEnDB = await Producto.findById(producto.producto);
            console.log('Buscando producto en la base de datos para agregar la venta:', productoEnDB);

            if (productoEnDB) {
                // Añadimos la venta al campo `ventas` del producto
                productoEnDB.ventas.push(venta._id);
                console.log('Venta asociada al producto:', productoEnDB);

                // Guardar el producto con la venta asociada
                await productoEnDB.save();
                console.log('Producto actualizado con la venta');

                // **Restar la cantidad al stock del producto**
                productoEnDB.stock -= producto.cantidad; // Restar la cantidad vendida al stock
                await productoEnDB.save(); // Guardar la actualización del stock
                console.log(`Stock actualizado para el producto ${productoEnDB.nombre}: ${productoEnDB.stock}`);
            } else {
                console.error('Producto no encontrado en la base de datos:', producto.productoId);
                return res.status(400).json({ error: 'Producto no encontrado en la base de datos' });
            }
        }

        console.log(cartId);

        if(cartId){
            await Cart.findByIdAndDelete(cartId);
            console.log('Carrito eliminado con éxito:', cartId);
        }

        // Emitir un evento con el nuevo pedido para los clientes conectados
        req.io.emit('nuevoPedido', nuevoPedido);

        res.status(201).json({
            message: 'Pedido creado con éxito',
            pedidoId: nuevoPedido._id,
            pedido: nuevoPedido
        });
    } catch (error) {
        console.error('Error al procesar el pedido:', error);
        res.status(400).json({ error: error.message });
    }
};

// Obtener todos los pedidos
exports.getPedidos = async (req, res) => {
    try {
        const pedidos = await Pedido.find().populate('mesa').populate('productos.productoId');
        res.status(200).json(pedidos);
    } catch (error) {
        console.error('Error al obtener los pedidos:', error);
        res.status(500).json({ error: 'Error al obtener los pedidos' });
    }
};

// Obtener un pedido por ID
exports.getPedidoById = async (req, res) => {
    const { id } = req.params;
    try {
        const pedido = await Pedido.findById(id).populate('mesa').populate('productos.productoId');
        if (!pedido) {
            return res.status(404).json({ error: 'Pedido no encontrado' });
        }
        res.status(200).json(pedido);
    } catch (error) {
        console.error('Error al obtener el pedido:', error);
        res.status(500).json({ error: 'Error al obtener el pedido' });
    }
};

// Actualizar un pedido por ID
exports.updatePedido = async (req, res) => {
    const { id } = req.params;
    const { productos, total, comensales, alergias, pan, estado } = req.body;

    try {
        const pedido = await Pedido.findById(id);

        if (!pedido) {
            return res.status(404).json({ error: 'Pedido no encontrado' });
        }

        // Actualizar los campos permitidos
        if (productos) pedido.productos = productos;
        if (total) pedido.total = parseFloat(total.toFixed(2));
        if (comensales) pedido.comensales = comensales;
        if (alergias) pedido.alergias = alergias;
        if (pan !== undefined) pedido.pan = pan;
        if (estado) pedido.estado = estado;

        // Guardar los cambios
        await pedido.save();

        res.status(200).json({ message: 'Pedido actualizado con éxito', pedido });
    } catch (error) {
        console.error('Error al actualizar el pedido:', error);
        res.status(400).json({ error: 'Error al actualizar el pedido' });
    }
};

// Eliminar un pedido por ID
exports.deletePedido = async (req, res) => {
    const { id } = req.params;

    try {
        const pedido = await Pedido.findByIdAndDelete(id);

        if (!pedido) {
            return res.status(404).json({ error: 'Pedido no encontrado' });
        }

        // Actualizar la mesa para quitar el pedido eliminado
        const mesa = await Mesa.findById(pedido.mesa);
        if (mesa) {
            mesa.pedidos = mesa.pedidos.filter(pedidoId => pedidoId.toString() !== id);
            mesa.total -= pedido.total;
            await mesa.save();
        }

        res.status(200).json({ message: 'Pedido eliminado con éxito' });
    } catch (error) {
        console.error('Error al eliminar el pedido:', error);
        res.status(500).json({ error: 'Error al eliminar el pedido' });
    }
};