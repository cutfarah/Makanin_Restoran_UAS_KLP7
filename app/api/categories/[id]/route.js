
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

// PUT/PATCH: Mengubah kategori
async function updateCategory(request, context) {
  const denied = await checkAdmin();
  if (denied) return denied;

  try {
    const id = await getId(context);

    if (!id) {
      return NextResponse.json(
        { success: false, message: "ID kategori tidak valid" },
        { status: 400 }
      );
    }

    const body = await request.json();

    const current = await prisma.category.findUnique({
      where: { id },
    });

    if (!current) {
      return NextResponse.json(
        { success: false, message: "Kategori tidak ditemukan" },
        { status: 404 }
      );
    }

    const data = {};

    if ("name" in body) {
      if (typeof body.name !== "string" || !body.name.trim()) {
        return NextResponse.json(
          { success: false, message: "Nama kategori tidak valid" },
          { status: 400 }
        );
      }

      data.name = body.name.trim();
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

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { success: false, message: "Tidak ada data yang diperbarui" },
        { status: 400 }
      );
    }

    const updated = await prisma.category.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      success: true,
      message: "Kategori berhasil diperbarui",
      data: updated,
    });
  } catch (error) {
    console.error("UPDATE category error:", error);

    if (error.code === "P2002") {
      return NextResponse.json(
        { success: false, message: "Nama kategori sudah digunakan" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Gagal memperbarui kategori" },
      { status: 500 }
    );
  }
}

export async function PUT(request, context) {
  return updateCategory(request, context);
}

export async function PATCH(request, context) {
  return updateCategory(request, context);
}

// DELETE: Menghapus kategori
export async function DELETE(request, context) {
  const denied = await checkAdmin();
  if (denied) return denied;

  try {
    const id = await getId(context);

    if (!id) {
      return NextResponse.json(
        { success: false, message: "ID kategori tidak valid" },
        { status: 400 }
      );
    }

    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            foods: true,
          },
        },
      },
    });

    if (!category) {
      return NextResponse.json(
        { success: false, message: "Kategori tidak ditemukan" },
        { status: 404 }
      );
    }

    if (category._count.foods > 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Kategori masih digunakan oleh makanan. Pindahkan makanan ke kategori lain terlebih dahulu.",
        },
        { status: 409 }
      );
    }

    await prisma.category.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Kategori berhasil dihapus",
    });
  } catch (error) {
    console.error("DELETE category error:", error);

    return NextResponse.json(
      { success: false, message: "Gagal menghapus kategori" },
      { status: 500 }
    );
  }
}
