"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuthRoutes = createAuthRoutes;
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
function createAuthRoutes() {
    const router = express_1.default.Router();
    /**
     * Login endpoint (mock for demo - replace with real auth logic)
     */
    router.post("/login", (req, res) => {
        const { email, password } = req.body;
        // Mock authentication - REPLACE WITH REAL LOGIC
        if (email && password) {
            const token = (0, auth_1.generateToken)("user-123", email, "OPERATOR");
            res.json({
                success: true,
                token,
                user: {
                    id: "user-123",
                    email,
                    role: "OPERATOR",
                },
            });
        }
        else {
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
    router.post("/verify", (req, res) => {
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
    router.get("/me", (req, res) => {
        const authReq = req;
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
