
import { NextResponse } from "next/server";
import { prisma } from "../../../src/lib/prisma";
import { requireRole } from "../../../src/lib/auth";

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

// GET: Mengambil semua makanan
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search")?.trim();
    const categoryIdParam = searchParams.get("categoryId");

    let categoryId;

    if (categoryIdParam !== null) {
      categoryId = Number(categoryIdParam);

      if (!Number.isInteger(categoryId) || categoryId <= 0) {
        return NextResponse.json(
          {
            success: false,
            message: "ID kategori tidak valid",
          },
          { status: 400 }
        );
      }
    }

    const where = {
      ...(search
        ? {
            name: {
              contains: search,
              mode: "insensitive",
            },
          }
        : {}),
      ...(categoryId !== undefined ? { categoryId } : {}),
    };

    const foods = await prisma.food.findMany({
      where,
      include: {
        category: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Berhasil mengambil data makanan",
      data: foods,
    });
  } catch (error) {
    console.error("GET foods error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal mengambil data makanan",
      },
      { status: 500 }
    );
  }
}

// POST: Admin menambahkan makanan
export async function POST(request) {
  const denied = await checkAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();

    const name =
      typeof body.name === "string" ? body.name.trim() : "";

    const price = Number(body.price);
    const stock =
      body.stock === undefined ? 20 : Number(body.stock);
    const categoryId = Number(body.categoryId);

    if (!name) {
      return NextResponse.json(
        { success: false, message: "Nama makanan wajib diisi" },
        { status: 400 }
      );
    }

    if (!Number.isSafeInteger(price) || price <= 0) {
      return NextResponse.json(
        { success: false, message: "Harga harus berupa bilangan bulat lebih dari 0" },
        { status: 400 }
      );
    }

    if (!Number.isSafeInteger(stock) || stock < 0) {
      return NextResponse.json(
        { success: false, message: "Stok tidak boleh negatif" },
        { status: 400 }
      );
    }

    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      return NextResponse.json(
        { success: false, message: "Kategori tidak valid" },
        { status: 400 }
      );
    }

    if (
      body.imageUrl !== undefined &&
      body.imageUrl !== null &&
      typeof body.imageUrl !== "string"
    ) {
      return NextResponse.json(
        { success: false, message: "URL gambar tidak valid" },
        { status: 400 }
      );
    }

    if (
      body.isAvailable !== undefined &&
      typeof body.isAvailable !== "boolean"
    ) {
      return NextResponse.json(
        { success: false, message: "Status ketersediaan tidak valid" },
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

    const food = await prisma.food.create({
      data: {
        name,
        description:
          typeof body.description === "string"
            ? body.description.trim() || null
            : null,
        price,
        stock,
        imageUrl: body.imageUrl?.trim() || null,
        isAvailable:
          typeof body.isAvailable === "boolean"
            ? body.isAvailable
            : stock > 0,
        categoryId,
      },
      include: {
        category: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Makanan berhasil ditambahkan",
        data: food,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST foods error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal menambahkan makanan",
      },
      { status: 500 }
    );
  }
}
