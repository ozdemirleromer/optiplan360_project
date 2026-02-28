import express, { Response } from "express";
import { generateToken, AuthRequest } from "../middleware/auth";

export function createAuthRoutes() {
  const router = express.Router();

  /**
   * Login endpoint (mock for demo - replace with real auth logic)
   */
  router.post("/login", (req, res: Response) => {
    const { email, password } = req.body;

    // Mock authentication - REPLACE WITH REAL LOGIC
    if (email && password) {
      const token = generateToken("user-123", email, "OPERATOR");
      res.json({
        success: true,
        token,
        user: {
          id: "user-123",
          email,
          role: "OPERATOR",
        },
      });
    } else {
      res.status(400).json({
        error: {
          code: "E_INVALID_CREDENTIALS",
          message: "Email ve şifre gerekli",
        },
      });
    }
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
