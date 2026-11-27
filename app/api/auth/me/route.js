import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../src/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Belum login atau session sudah berakhir.",
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Session pengguna aktif.",
        data: user,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Session API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal memeriksa session.",
      },
      { status: 500 }
    );
  }
}