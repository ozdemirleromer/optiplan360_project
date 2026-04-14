import express, { Response } from "express";

import { generateToken, AuthRequest } from "../../../middleware/auth";
import { isDemoLoginEnabled } from "./demo-auth";

const DEMO_USERNAME = "admin";
const DEMO_EMAIL = "admin@optiplan360.local";
const DEMO_PASSWORD = "admin";
const DEMO_ROLE = "ADMIN";

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function createAuthRoutes() {
  const router = express.Router();

  /**
   * Demo login endpoint for the orchestrator dashboard.
   */
  router.post("/login", (req, res: Response) => {
    if (!isDemoLoginEnabled()) {
      res.status(404).json({
        error: {
          code: "E_NOT_FOUND",
          message: "Endpoint bulunamadı",
        },
      });
      return;
    }

    const username = normalizeString(req.body?.username);
    const email = normalizeString(req.body?.email);
    const password = normalizeString(req.body?.password);
    const loginIdentifier = username || email;

    if (loginIdentifier === DEMO_USERNAME || loginIdentifier === DEMO_EMAIL) {
      if (password !== DEMO_PASSWORD) {
        res.status(400).json({
          error: {
            code: "E_INVALID_CREDENTIALS",
            message: "Kullanıcı adı veya şifre hatalı",
          },
        });
        return;
      }

      const token = generateToken("user-123", DEMO_EMAIL, DEMO_ROLE);

      res.json({
        success: true,
        token,
        user: {
          id: "user-123",
          username: DEMO_USERNAME,
          email: DEMO_EMAIL,
          role: DEMO_ROLE,
        },
      });
      return;
    }

    res.status(400).json({
      error: {
        code: "E_INVALID_CREDENTIALS",
        message: "Kullanıcı adı veya e-posta ve şifre gerekli",
      },
    });
  });

  /**
   * Verify token endpoint
   */
  router.post("/verify", (req, res: Response) => {
    const { token } = req.body;

    if (!token) {
      res.status(400).json({
        error: {
          code: "E_TOKEN_REQUIRED",
          message: "Token gerekli",
        },
      });
      return;
    }

    // Token verification handled by middleware
    res.json({ success: true, message: "Token geçerli" });
  });

  /**
   * Get current user endpoint
   */
  router.get("/me", (req, res: Response) => {
    const authReq = req as AuthRequest;

    if (!authReq.user) {
      res.status(401).json({
        error: {
          code: "E_UNAUTHORIZED",
          message: "Kimlik doğrulama gerekli",
        },
      });
      return;
    }

    res.json({
      user: authReq.user,
    });
  });

  return router;
}
