import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";
import { hashPassword } from "../../../../src/lib/auth";

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
    if (
      !EMAIL_PATTERN.test(email) ||
      email.length > 254
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Format email tidak valid.",
        },
        { status: 400 }
      );
    }

    // Validasi nomor HP
    if (!/^[0-9]{10,13}$/.test(phone)) {
      return NextResponse.json(
        {
          success: false,
          message: "Nomor HP harus terdiri dari 10-13 digit.",
        },
        { status: 400 }
      );
    }

    // Validasi alamat
    if (!address || address.length > 500) {
      return NextResponse.json(
        {
          success: false,
          message: "Alamat wajib diisi dan maksimal 500 karakter.",
        },
        { status: 400 }
      );
    }

    // Validasi password
    const passwordBytes =
      new TextEncoder().encode(password).length;

    if (password.length < 8 || passwordBytes > 72) {
      return NextResponse.json(
        {
          success: false,
          message: "Password minimal 8 karakter dan maksimal 72 byte.",
        },
        { status: 400 }
      );
    }

    // Periksa email yang sudah terdaftar
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

    // Simpan customer ke database
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        phone,
        address,
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