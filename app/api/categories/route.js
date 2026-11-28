
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

// GET: Mengambil semua kategori
export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: {
        name: "asc",
      },
      include: {
        _count: {
          select: {
            foods: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Berhasil mengambil data kategori",
      data: categories,
    });
  } catch (error) {
    console.error("GET categories error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal mengambil data kategori",
      },
      { status: 500 }
    );
  }
}

// POST: Admin menambahkan kategori
export async function POST(request) {
  const denied = await checkAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();

    const name =
      typeof body.name === "string" ? body.name.trim() : "";

    if (!name) {
      return NextResponse.json(
        { success: false, message: "Nama kategori wajib diisi" },
        { status: 400 }
      );
    }

    const category = await prisma.category.create({
      data: {
        name,
        description:
          typeof body.description === "string"
            ? body.description.trim() || null
            : null,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Kategori berhasil ditambahkan",
        data: category,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST categories error:", error);

    if (error.code === "P2002") {
      return NextResponse.json(
        { success: false, message: "Nama kategori sudah digunakan" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Gagal menambahkan kategori" },
      { status: 500 }
    );
  }
}
