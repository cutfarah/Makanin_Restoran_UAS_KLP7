
import { NextResponse } from "next/server";
import { prisma } from "../../../src/lib/prisma";

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
