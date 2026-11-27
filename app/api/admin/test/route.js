import { NextResponse } from "next/server";
import { requireRole } from "../../../../src/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const result = await requireRole("ADMIN");

    if (!result.user) {
      return NextResponse.json(
        {
          success: false,
          message: result.message,
        },
        { status: result.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Akses ADMIN berhasil.",
      data: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
      },
    });
  } catch (error) {
    console.error("Admin test error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Terjadi kesalahan.",
      },
      { status: 500 }
    );
  }
}