"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = generateToken;
exports.authenticateToken = authenticateToken;
exports.requireRole = requireRole;
exports.devBypassAuth = devBypassAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-key-change-in-production";
/**
 * Generate JWT token for user
 */
function generateToken(userId, email, role) {
    return jsonwebtoken_1.default.sign({ id: userId, email, role }, JWT_SECRET, { expiresIn: process.env.NODE_ENV === "production" ? "24h" : "7d" });
}
/**
 * Verify JWT token middleware
 */
function authenticateToken(req, res, next) {
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
    jsonwebtoken_1.default.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            res.status(403).json({
                error: {
                    code: "E_FORBIDDEN",
                    message: "Geçersiz veya süresi dolmuş token",
                },
            });
            return;
        }
        req.user = decoded;
        next();
    });
}
/**
 * Require specific role middleware
 */
function requireRole(...roles) {
    return (req, res, next) => {
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
function devBypassAuth(req, res, next) {
    if (process.env.NODE_ENV !== "production") {
        // In dev mode, set a default user if no auth header
        const authHeader = req.headers["authorization"];
        if (!authHeader) {
            req.user = {
                id: "dev-user",
                email: "dev@example.com",
                role: "ADMIN",
            };
        }
    }
    next();
}
