
import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";
import { requireRole } from "../../../../src/lib/auth";

async function checkAdmin() {
  const access = await requireRole("ADMIN");

  if (!access.user) {
    return NextResponse.json(
      {
        success: false,
        message: access.message,
      },
      { status: access.status }
    );
  }

  return null;
}

async function getId(context) {
  const params = await context.params;
  const id = Number(params.id);

  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

// PUT/PATCH: Memperbarui makanan
async function updateFood(request, context) {
  const denied = await checkAdmin();
  if (denied) return denied;

  try {
    const id = await getId(context);

    if (!id) {
      return NextResponse.json(
        { success: false, message: "ID makanan tidak valid" },
        { status: 400 }
      );
    }

    const body = await request.json();

    const current = await prisma.food.findUnique({
      where: { id },
    });

    if (!current) {
      return NextResponse.json(
        { success: false, message: "Makanan tidak ditemukan" },
        { status: 404 }
      );
    }

    const data = {};

    if ("name" in body) {
      if (typeof body.name !== "string" || !body.name.trim()) {
        return NextResponse.json(
          { success: false, message: "Nama makanan tidak valid" },
          { status: 400 }
        );
      }

      data.name = body.name.trim();
    }

    if ("price" in body) {
      const price = Number(body.price);

      if (!Number.isSafeInteger(price) || price <= 0) {
        return NextResponse.json(
          { success: false, message: "Harga harus lebih dari 0" },
          { status: 400 }
        );
      }

      data.price = price;
    }

    if ("stock" in body) {
      const stock = Number(body.stock);

      if (!Number.isSafeInteger(stock) || stock < 0) {
        return NextResponse.json(
          { success: false, message: "Stok tidak boleh negatif" },
          { status: 400 }
        );
      }

      data.stock = stock;
    }

    if ("categoryId" in body) {
      const categoryId = Number(body.categoryId);

      if (!Number.isInteger(categoryId) || categoryId <= 0) {
        return NextResponse.json(
          { success: false, message: "Kategori tidak valid" },
          { status: 400 }
        );
      }

      const category = await prisma.category.findUnique({
        where: { id: categoryId },
      });

      if (!category) {
        return NextResponse.json(
          { success: false, message: "Kategori tidak ditemukan" },
          { status: 404 }
        );
      }

      data.categoryId = categoryId;
    }

    if ("description" in body) {
      if (
        body.description !== null &&
        typeof body.description !== "string"
      ) {
        return NextResponse.json(
          { success: false, message: "Deskripsi tidak valid" },
          { status: 400 }
        );
      }

      data.description =
        typeof body.description === "string"
          ? body.description.trim() || null
          : null;
    }

    if ("imageUrl" in body) {
      if (
        body.imageUrl !== null &&
        typeof body.imageUrl !== "string"
      ) {
        return NextResponse.json(
          { success: false, message: "URL gambar tidak valid" },
          { status: 400 }
        );
      }

      data.imageUrl =
        typeof body.imageUrl === "string"
          ? body.imageUrl.trim() || null
          : null;
    }

    if ("isAvailable" in body) {
      if (typeof body.isAvailable !== "boolean") {
        return NextResponse.json(
          { success: false, message: "Status ketersediaan tidak valid" },
          { status: 400 }
        );
      }

      data.isAvailable = body.isAvailable;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { success: false, message: "Tidak ada data yang diperbarui" },
        { status: 400 }
      );
    }

    if (data.stock === 0 && data.isAvailable === undefined) {
      data.isAvailable = false;
    }

    const updated = await prisma.food.update({
      where: { id },
      data,
      include: {
        category: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Makanan berhasil diperbarui",
      data: updated,
    });
  } catch (error) {
    console.error("UPDATE food error:", error);

    return NextResponse.json(
      { success: false, message: "Gagal memperbarui makanan" },
      { status: 500 }
    );
  }
}

export async function PUT(request, context) {
  return updateFood(request, context);
}

export async function PATCH(request, context) {
  return updateFood(request, context);
}

// DELETE: Menghapus makanan
export async function DELETE(request, context) {
  const denied = await checkAdmin();
  if (denied) return denied;

  try {
    const id = await getId(context);

    if (!id) {
      return NextResponse.json(
        { success: false, message: "ID makanan tidak valid" },
        { status: 400 }
      );
    }

    const food = await prisma.food.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            orderItems: true,
            reviews: true,
          },
        },
      },
    });

    if (!food) {
      return NextResponse.json(
        { success: false, message: "Makanan tidak ditemukan" },
        { status: 404 }
      );
    }

    if (
      food._count.orderItems > 0 ||
      food._count.reviews > 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Makanan sudah memiliki riwayat pesanan atau ulasan. Nonaktifkan menu melalui fitur edit agar riwayat tetap tersimpan.",
        },
        { status: 409 }
      );
    }

    await prisma.food.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Makanan berhasil dihapus",
    });
  } catch (error) {
    console.error("DELETE food error:", error);

    return NextResponse.json(
      { success: false, message: "Gagal menghapus makanan" },
      { status: 500 }
    );
  }
}
