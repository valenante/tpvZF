import MesaCerrada from "../models/MesaCerrada.js";
import Password from "../models/Password.js";
import CajaDiaria from "../models/CajaDiaria.js";
import Pedido from "../models/Pedido.js";
import Cart from "../models/Cart.js";
import Mesa from "../models/Mesa.js";
import PDFDocument from "pdfkit";
import nodemailer from "nodemailer";


export const getCaja = async (req, res) => {
    try {
        // Obtener todas las mesas cerradas desde el modelo MesaCerrada
        const mesasCerradas = await MesaCerrada.find();

        // Calcular el total sumando los métodos de pago de todas las mesas cerradas
        const total = mesasCerradas.reduce((acc, mesa) => {
            const totalMesa = Object.values(mesa.metodoPago).reduce((sum, value) => sum + value, 0);
            return acc + totalMesa;
        }, 0);

        // Devolver el total como respuesta
        res.json({ total });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al obtener el total de caja" });
    }
};

export const cerrarCaja = async (req, res) => {
    try {
        const passwordDoc = await Password.findOne();

        if (!passwordDoc || !passwordDoc.valor) {
            return res.status(404).json({ message: "Contraseña no encontrada" });
        }

        const passwordValor = passwordDoc.valor;
        const { password } = req.body;

        if (password !== passwordValor) {
            return res.status(401).json({ message: "Contraseña incorrecta" });
        }

        const mesasCerradas = await MesaCerrada.find();
        const total = mesasCerradas.reduce((acc, mesa) => {
            const totalMesa = Object.values(mesa.metodoPago).reduce((sum, value) => sum + value, 0);
            return acc + totalMesa;
        }, 0);

        const cajaDiaria = new CajaDiaria({ total, fecha: new Date(), ingresos: total });
        await cajaDiaria.save();

        // Restablecer datos
        await MesaCerrada.deleteMany({});
        await Pedido.deleteMany({});
        await Cart.deleteMany({});
        await Mesa.updateMany({}, { $set: { total: 0, pedidos: [] } });

        // Generar PDF
        const pdfBuffer = await generarPDF(mesasCerradas, total);

        // Enviar Email
        await enviarEmailConPDF(pdfBuffer);

        res.json({ message: "Caja cerrada y datos restablecidos correctamente" });
    } catch (error) {
        console.error("Error al cerrar la caja:", error);
        res.status(500).json({ message: "Error al cerrar la caja" });
    }
};

const generarPDF = (mesasCerradas, total) => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument();
        const buffers = [];

        doc.on("data", buffers.push.bind(buffers));
        doc.on("end", () => resolve(Buffer.concat(buffers)));
        doc.on("error", reject);

        // Contenido del PDF
        doc.fontSize(20).text("Informe Diario", { align: "center" });
        doc.fontSize(14).text(`Fecha: ${new Date().toLocaleDateString()}`, { align: "right" });

        doc.moveDown();
        mesasCerradas.forEach((mesa, index) => {
            doc.text(`Mesa ${mesa.numero}:`);
            doc.text(`  Total: ${mesa.total} €`);
            doc.text(`  Método de Pago: Efectivo - ${mesa.metodoPago.efectivo} €, Tarjeta - ${mesa.metodoPago.tarjeta} €`);
            doc.moveDown();
        });

        doc.text(`Total del Día: ${total.toFixed(2)} €`, { align: "right" });
        doc.end();
    });
};

const enviarEmailConPDF = async (pdfBuffer) => {
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    await transporter.sendMail({
        from: '"Sistema TPV" valentinoantenucci1@gmail.com',
        to: "valentinoantenucci1@gmail.com", // Correo del destinatario
        subject: "Informe Diario - Cierre de Caja",
        text: "Adjunto se encuentra el informe diario del cierre de caja.",
        attachments: [
            {
                filename: `informe-diario-${new Date().toISOString().slice(0, 10)}.pdf`,
                content: pdfBuffer,
                contentType: "application/pdf",
            },
        ],
    });
};