import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { users, user_outlets, user_permissions } from "../../db/schema";
import { verifyPassword, hashPassword } from "../../lib/crypto";
import { generateTokens, verifyRefreshToken } from "../../middleware/auth";
import type { JwtPayload } from "../../lib/types";
import type { RegisterInput } from "./schema";

async function loadUserClaims(db: any, userId: string) {
  const [outletsRes, permissionsRes] = await Promise.all([
    db.select({ outlet_id: user_outlets.outlet_id }).from(user_outlets).where(eq(user_outlets.user_id, userId)),
    db.select({ permission: user_permissions.permission }).from(user_permissions).where(eq(user_permissions.user_id, userId))
  ]);

  return {
    outlet_ids: outletsRes.map((o: any) => o.outlet_id),
    permissions: permissionsRes.map((p: any) => p.permission)
  };
}

export async function login(db: any, username: string, passwordText: string, jwtSecret: string, refreshSecret: string) {
  const user = await db.select().from(users).where(eq(users.username, username)).limit(1).then((res: any) => res[0]);
  
  if (!user) {
    throw new HTTPException(401, { message: "Invalid credentials" });
  }

  if (!user.is_active) {
    throw new HTTPException(403, { message: "Account disabled" });
  }

  const isValid = await verifyPassword(passwordText, user.password_hash);
  if (!isValid) {
    throw new HTTPException(401, { message: "Invalid credentials" });
  }

  const claims = await loadUserClaims(db, user.id);

  const payload: Omit<JwtPayload, "exp"> = {
    sub: user.id,
    username: user.username,
    role: user.role,
    outlet_ids: claims.outlet_ids,
    permissions: claims.permissions,
  };

  const tokens = await generateTokens(payload, jwtSecret, refreshSecret);

  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.username, // Alias for frontend compatibility
      display_name: user.display_name,
      role: user.role,
    },
    tokens,
  };
}

export async function refresh(db: any, refreshToken: string, jwtSecret: string, refreshSecret: string) {
  let decoded;
  try {
    decoded = await verifyRefreshToken(refreshToken, refreshSecret);
  } catch (e) {
    throw new HTTPException(401, { message: "Invalid or expired refresh token" });
  }

  const user = await db.select().from(users).where(eq(users.id, decoded.sub)).limit(1).then((res: any) => res[0]);
  
  if (!user) {
    throw new HTTPException(401, { message: "Invalid refresh token" });
  }

  if (!user.is_active) {
    throw new HTTPException(403, { message: "Account disabled" });
  }

  const claims = await loadUserClaims(db, user.id);

  const payload: Omit<JwtPayload, "exp"> = {
    sub: user.id,
    username: user.username,
    role: user.role,
    outlet_ids: claims.outlet_ids,
    permissions: claims.permissions,
  };

  const tokens = await generateTokens(payload, jwtSecret, refreshSecret);

  return {
    user: {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      role: user.role,
    },
    tokens,
  };
}

export async function getMe(db: any, userId: string) {
  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1).then((res: any) => res[0]);
  
  if (!user) {
    throw new HTTPException(404, { message: "User not found" });
  }

  const claims = await loadUserClaims(db, user.id);

  return {
    id: user.id,
    username: user.username,
    email: user.username, // Alias for frontend compatibility
    display_name: user.display_name,
    role: user.role,
    is_active: user.is_active,
    outlet_ids: claims.outlet_ids,
    permissions: claims.permissions,
  };
}

export async function register(db: any, input: RegisterInput) {
  // Check if username exists
  const existingUser = await db.select().from(users).where(eq(users.username, input.username)).limit(1).then((res: any) => res[0]);
  if (existingUser) {
    throw new HTTPException(400, { message: "Username already exists" });
  }

  const hashedPassword = await hashPassword(input.password);
  
  const newUser = await db.insert(users).values({
    username: input.username,
    display_name: input.display_name,
    password_hash: hashedPassword,
    role: "pending", // default role for self-registered
    is_active: false // requires superadmin approval
  }).returning().then((res: any) => res[0]);

  return {
    id: newUser.id,
    username: newUser.username,
    display_name: newUser.display_name,
    is_active: newUser.is_active
  };
}
