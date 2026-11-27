import { NextResponse } from "next/server";
import { clearSession } from "../../../../src/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  try {
    await clearSession();

    return NextResponse.json({
      success: true,
      message: "Logout berhasil.",
    });
  } catch (error) {
    console.error("Logout API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal melakukan logout.",
      },
      { status: 500 }
    );
  }
}