import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";
import { hashPassword } from "../../../../src/lib/auth";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();

    const name =
      typeof body.name === "string" ? body.name.trim() : "";

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string" ? body.password : "";

    const phone =
      typeof body.phone === "string" ? body.phone.trim() : "";

    const address =
      typeof body.address === "string" ? body.address.trim() : "";

    // Validasi nama
    if (name.length < 2 || name.length > 100) {
      return NextResponse.json(
        {
          success: false,
          message: "Nama harus terdiri dari 2-100 karakter.",
        },
        { status: 400 }
      );
    }

    // Validasi email
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email) || email.length > 254) {
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
      password.length < 8 ||
      new TextEncoder().encode(password).length > 72
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Password harus minimal 8 karakter dan maksimal 72 byte.",
        },
        { status: 400 }
      );
    }

    if (phone.length > 30 || address.length > 500) {
      return NextResponse.json(
        {
          success: false,
          message: "Data nomor HP atau alamat terlalu panjang.",
        },
        { status: 400 }
      );
    }

    // Periksa apakah email sudah terdaftar
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          message: "Email sudah terdaftar.",
        },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Simpan pengguna ke database
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        phone: phone || null,
        address: address || null,
        role: "CUSTOMER",
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        role: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Registrasi berhasil. Silakan login.",
        data: user,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Register API error:", error);

    if (error.code === "P2002") {
      return NextResponse.json(
        {
          success: false,
          message: "Email sudah terdaftar.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Terjadi kesalahan saat registrasi.",
      },
      { status: 500 }
    );
  }
}