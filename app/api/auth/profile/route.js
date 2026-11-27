import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../src/lib/auth";
import { prisma } from "../../../../src/lib/prisma";

export const runtime = "nodejs";

export async function PUT(request) {
  try {
    // Periksa session pengguna
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Silakan login terlebih dahulu.",
        },
        { status: 401 }
      );
    }

    // Ambil data dari frontend
    let body;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Format data tidak valid.",
        },
        { status: 400 }
      );
    }

    const name = String(body.name || "").trim();
    const phone = String(body.phone || "").trim();
    const address = String(body.address || "").trim();

    // Validasi nama
    if (!name) {
      return NextResponse.json(
        {
          success: false,
          message: "Nama lengkap wajib diisi.",
        },
        { status: 400 }
      );
    }

    // Validasi nomor HP
    if (!/^[0-9]{10,13}$/.test(phone)) {
      return NextResponse.json(
        {
          success: false,
          message: "Nomor HP harus 10–13 digit.",
        },
        { status: 400 }
      );
    }

    // Validasi alamat
    if (!address) {
      return NextResponse.json(
        {
          success: false,
          message: "Alamat wajib diisi.",
        },
        { status: 400 }
      );
    }

    // Update data langsung ke PostgreSQL
    const updatedUser = await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        name,
        phone,
        address,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        role: true,
        isActive: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Profil berhasil diperbarui.",
        data: updatedUser,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );

  } catch (error) {
    console.error("Update profile error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal memperbarui profil.",
      },
      { status: 500 }
    );
  }
}