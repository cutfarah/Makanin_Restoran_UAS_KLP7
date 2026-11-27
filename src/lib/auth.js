import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

// Nama cookie untuk session
export const SESSION_COOKIE_NAME = "makanin_session";

// Masa berlaku session: 7 hari
const SESSION_DURATION = 60 * 60 * 24 * 7;

// Membaca secret untuk JWT
function getSecretKey() {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error("AUTH_SECRET belum dikonfigurasi.");
  }

  return new TextEncoder().encode(secret);
}

// Konfigurasi cookie
export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: SESSION_DURATION,
};

// Hash password sebelum disimpan
export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

// Memeriksa password dengan hash di database
export async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

// Membuat session setelah login berhasil
export async function createSession(user) {
  const token = await new SignJWT({
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(getSecretKey());

  const cookieStore = await cookies();

  cookieStore.set(
    SESSION_COOKIE_NAME,
    token,
    sessionCookieOptions
  );
}

// Mengambil pengguna yang sedang login
export async function getCurrentUser() {
  const cookieStore = await cookies();

  const token = cookieStore.get(
    SESSION_COOKIE_NAME
  )?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(
      token,
      getSecretKey(),
      { algorithms: ["HS256"] }
    );

    if (typeof payload.sub !== "string") {
      return null;
    }

    // Ambil data terbaru dari database
    const user = await prisma.user.findUnique({
      where: {
        id: payload.sub,
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

    if (!user || !user.isActive) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

// Memeriksa hak akses pengguna
export async function requireRole(requiredRole) {
  const user = await getCurrentUser();

  if (!user) {
    return {
      user: null,
      status: 401,
      message: "Silakan login terlebih dahulu.",
    };
  }

  if (user.role !== requiredRole) {
    return {
      user: null,
      status: 403,
      message: "Anda tidak memiliki hak akses.",
    };
  }

  return {
    user,
    status: 200,
    message: null,
  };
}

// Menghapus session saat logout
export async function clearSession() {
  const cookieStore = await cookies();

  cookieStore.set(
    SESSION_COOKIE_NAME,
    "",
    {
      ...sessionCookieOptions,
      maxAge: 0,
    }
  );
}