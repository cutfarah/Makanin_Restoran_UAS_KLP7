import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";
import {
  verifyPassword,
  createSession,
} from "../../../../src/lib/auth";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          message: "Email dan password wajib diisi.",
        },
        { status: 400 }
      );
    }

    // Cari pengguna berdasarkan email
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        passwordHash: true,
        role: true,
        isActive: true,
      },
    });

    // Periksa akun dan password
    if (
      !user ||
      !user.passwordHash ||
      !(await verifyPassword(password, user.passwordHash))
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Email atau password salah.",
        },
        { status: 401 }
      );
    }

    // Periksa status akun
    if (!user.isActive) {
      return NextResponse.json(
        {
          success: false,
          message: "Akun tidak aktif.",
        },
        { status: 403 }
      );
    }

    // Buat session login
    await createSession(user);

    // Jangan mengirim passwordHash ke frontend
    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      address: user.address,
      role: user.role,
    };

    return NextResponse.json(
      {
        success: true,
        message: "Login berhasil.",
        data: safeUser,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Login API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Terjadi kesalahan saat login.",
      },
      { status: 500 }
    );
  }
}