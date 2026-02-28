import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ERROR_CODES } from "../domain/errors";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: "ADMIN" | "OPERATOR" | "VIEWER";
  };
}

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-key-change-in-production";

/**
 * Generate JWT token for user
 */
export function generateToken(userId: string, email: string, role: string): string {
  return jwt.sign(
    { id: userId, email, role },
    JWT_SECRET,
    { expiresIn: process.env.NODE_ENV === "production" ? "24h" : "7d" }
  );
}

/**
 * Verify JWT token middleware
 */
export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    res.status(401).json({
      error: {
        code: "E_UNAUTHORIZED",
        message: "Token gerekli",
      },
    });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      res.status(403).json({
        error: {
          code: "E_FORBIDDEN",
          message: "Geçersiz veya süresi dolmuş token",
        },
      });
      return;
    }

    req.user = decoded as AuthRequest["user"];
    next();
  });
}

/**
 * Require specific role middleware
 */
export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: "E_UNAUTHORIZED",
          message: "Kimlik doğrulama gerekli",
        },
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: {
          code: "E_FORBIDDEN",
          message: `Bu işlem için '${roles.join("/")}' rolü gerekli`,
        },
      });
      return;
    }

    next();
  };
}

/**
 * Development mode: Bypass auth (for testing)
 */
export function devBypassAuth(req: Request, res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV !== "production") {
    // In dev mode, set a default user if no auth header
    const authHeader = req.headers["authorization"];
    if (!authHeader) {
      (req as AuthRequest).user = {
        id: "dev-user",
        email: "dev@example.com",
        role: "ADMIN",
      };
    }
  }
  next();
}
