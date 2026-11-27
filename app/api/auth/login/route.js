import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";
import {
  verifyPassword,
  createSession,
} from "../../../../src/lib/auth";

export const runtime = "nodejs";

const EMAIL_PATTERN =
  /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i;

export async function POST(request) {
  try {
    let body;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Format permintaan tidak valid.",
        },
        { status: 400 }
      );
    }

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    // Validasi email
    if (!EMAIL_PATTERN.test(email) || email.length > 254) {
      return NextResponse.json(
        {
          success: false,
          message: "Format email tidak valid.",
        },
        { status: 400 }
      );
    }

    // Validasi password
    if (
      !password ||
      new TextEncoder().encode(password).length > 72
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Password tidak valid.",
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

    // Buat session
    await createSession(user);

    // Jangan kirim passwordHash ke frontend
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