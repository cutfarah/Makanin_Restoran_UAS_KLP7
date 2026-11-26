
import { NextResponse } from "next/server";
import { prisma } from "../../../src/lib/prisma";

// GET: Mengambil semua data makanan
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search")?.trim();
    const categoryIdParam = searchParams.get("categoryId");

    // Validasi categoryId
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

    // Filter makanan
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
