
import { NextResponse } from "next/server";
import { prisma } from "../../../src/lib/prisma";
import { getCurrentUser } from "../../../src/lib/auth";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET: Ambil pesanan dari Prisma
export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Silakan login." },
        { status: 401 }
      );
    }

    const orders = await prisma.order.findMany({
      where: user.role === "ADMIN"
        ? {}
        : { customerId: user.id },
      include: {
        items: true,
        payment: true
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return NextResponse.json(
      {
        success: true,
        data: orders
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0"
        }
      }
    );

  } catch (error) {
    console.error("GET orders:", error);

    return NextResponse.json(
      { success: false, message: "Gagal mengambil pesanan." },
      { status: 500 }
    );
  }
}

// POST: Buat pesanan ke Prisma
export async function POST(request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Silakan login." },
        { status: 401 }
      );
    }

    if (user.role !== "CUSTOMER") {
      return NextResponse.json(
        { success: false, message: "Akses ditolak." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const orderType = {
      "Dine In": "DINE_IN",
      "Online": "DELIVERY"
    }[body.orderType];

    const paymentMethod = {
      "COD": "CASH",
      "Transfer Bank": "BANK_TRANSFER",
      "GoPay": "GOPAY"
    }[body.payment];

    if (!orderType || !paymentMethod) {
      return NextResponse.json(
        { success: false, message: "Jenis pesanan atau pembayaran tidak valid." },
        { status: 400 }
      );
    }

    const name = String(body.name || "").trim();
    const phone = String(body.phone || "").trim();
    const address = String(body.address || "").trim();
    const tableNumber = String(body.tableNumber || "").trim();

    if (!name || !/^[0-9]{10,13}$/.test(phone)) {
      return NextResponse.json(
        { success: false, message: "Data pelanggan tidak valid." },
        { status: 400 }
      );
    }

    if (orderType === "DELIVERY" && !address) {
      return NextResponse.json(
        { success: false, message: "Alamat pengantaran wajib diisi." },
        { status: 400 }
      );
    }

    if (orderType === "DINE_IN" && !tableNumber) {
      return NextResponse.json(
        { success: false, message: "Nomor meja wajib diisi." },
        { status: 400 }
      );
    }

    if (
      (orderType === "DINE_IN" && paymentMethod !== "CASH") ||
      (orderType === "DELIVERY" &&
        !["BANK_TRANSFER", "GOPAY"].includes(paymentMethod))
    ) {
      return NextResponse.json(
        { success: false, message: "Metode pembayaran tidak sesuai." },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.items) || !body.items.length) {
      return NextResponse.json(
        { success: false, message: "Keranjang kosong." },
        { status: 400 }
      );
    }

    const requested = new Map();

    for (const item of body.items) {
      const id = Number(item.id);
      const qty = Number(item.qty);

      if (
        !Number.isSafeInteger(id) ||
        id <= 0 ||
        !Number.isSafeInteger(qty) ||
        qty <= 0
      ) {
        return NextResponse.json(
          { success: false, message: "Item pesanan tidak valid." },
          { status: 400 }
        );
      }

      requested.set(id, (requested.get(id) || 0) + qty);
    }

    const foods = await prisma.food.findMany({
      where: {
        id: { in: [...requested.keys()] },
        isAvailable: true
      }
    });

    if (foods.length !== requested.size) {
      return NextResponse.json(
        { success: false, message: "Ada menu yang sudah tidak tersedia." },
        { status: 400 }
      );
    }

    const foodMap = new Map(foods.map(f => [f.id, f]));

    let subtotal = 0;

    const orderItems = [...requested.entries()].map(([id, qty]) => {
      const food = foodMap.get(id);

      if (food.stock < qty) {
        throw new Error(`Stok ${food.name} tidak mencukupi.`);
      }

      subtotal += food.price * qty;

      return {
        foodId: food.id,
        foodName: food.name,
        unitPrice: food.price,
        quantity: qty,
        lineTotal: food.price * qty,
        imageUrl: food.imageUrl
      };
    });

    const deliveryFee =
      orderType === "DELIVERY" && subtotal < 150000
        ? 15000
        : 0;

    const total = subtotal + deliveryFee;
    const isPaid = orderType === "DELIVERY";

    const order = await prisma.$transaction(async tx => {

      for (const item of orderItems) {
        const food = foodMap.get(item.foodId);

        const updated = await tx.food.updateMany({
          where: {
            id: item.foodId,
            stock: { gte: item.quantity },
            isAvailable: true
          },
          data: {
            stock: { decrement: item.quantity },
            ...(food.stock === item.quantity
              ? { isAvailable: false }
              : {})
          }
        });

        if (!updated.count) {
          throw new Error(`Stok ${food.name} tidak mencukupi.`);
        }
      }

      return tx.order.create({
        data: {
          orderCode: `MK-${Date.now()}-${randomUUID().slice(0, 8)}`,
          orderType,
          status: "PENDING_CONFIRMATION",

          customerId: user.id,
          customerName: name,
          customerPhone: phone,
          customerEmail: user.email,

          recipientName: orderType === "DELIVERY" ? name : null,
          recipientPhone: orderType === "DELIVERY" ? phone : null,

          deliveryAddress: orderType === "DELIVERY" ? address : null,
          tableNumber: orderType === "DINE_IN" ? tableNumber : null,

          subtotal,
          deliveryFee,
          discountAmount: 0,
          total,

          items: {
            create: orderItems
          },

          payment: {
            create: {
              method: paymentMethod,
              status: isPaid ? "PAID" : "PENDING",
              amount: total,
              paidAt: isPaid ? new Date() : null
            }
          }
        },
        include: {
          items: true,
          payment: true
        }
      });
    });

    return NextResponse.json({
      success: true,
      message: "Pesanan berhasil dibuat.",
      data: order
    }, { status: 201 });

  } catch (error) {
    console.error("POST orders:", error);

    return NextResponse.json(
      {
        success: false,
        message: error.message || "Gagal membuat pesanan."
      },
      { status: 400 }
    );
  }
}


export async function PATCH(request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Silakan login." },
        { status: 401 }
      );
    }

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, message: "Akses ditolak." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const id = String(body.id || "").trim();
    const status = body.status;
    const paymentStatus = body.paymentStatus;

    const validStatuses = [
      "PENDING_CONFIRMATION",
      "PROCESSING",
      "PREPARING",
      "OUT_FOR_DELIVERY",
      "COMPLETED",
      "CANCELLED"
    ];

    const validPayments = [
      "PENDING",
      "PAID",
      "FAILED",
      "REFUNDED"
    ];

    if (!id || (!status && !paymentStatus)) {
      return NextResponse.json(
        { success: false, message: "Data tidak lengkap." },
        { status: 400 }
      );
    }

    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, message: "Status pesanan tidak valid." },
        { status: 400 }
      );
    }

    if (paymentStatus && !validPayments.includes(paymentStatus)) {
      return NextResponse.json(
        { success: false, message: "Status pembayaran tidak valid." },
        { status: 400 }
      );
    }

    const existing = await prisma.order.findUnique({
      where: { id },
      include: { payment: true }
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Pesanan tidak ditemukan." },
        { status: 404 }
      );
    }

    if (paymentStatus && !existing.payment) {
      return NextResponse.json(
        { success: false, message: "Pembayaran tidak ditemukan." },
        { status: 404 }
      );
    }

    const updated = await prisma.$transaction(async tx => {

      if (status) {
        await tx.order.update({
          where: { id },
          data: { status }
        });
      }

      if (paymentStatus) {
        await tx.payment.update({
          where: { orderId: id },
          data: {
            status: paymentStatus,
            paidAt: paymentStatus === "PAID"
              ? new Date()
              : null
          }
        });
      }

      return tx.order.findUnique({
        where: { id },
        include: {
          items: true,
          payment: true
        }
      });
    });

    return NextResponse.json({
      success: true,
      message: "Pesanan berhasil diperbarui.",
      data: updated
    });

  } catch (error) {
    console.error("PATCH orders:", error);

    return NextResponse.json(
      {
        success: false,
        message: error.message || "Gagal memperbarui pesanan."
      },
      { status: 500 }
    );
  }
}