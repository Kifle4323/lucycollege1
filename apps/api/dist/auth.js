"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JWTPayloadSchema = void 0;
exports.signAccessToken = signAccessToken;
exports.signRefreshToken = signRefreshToken;
exports.verifyAccessToken = verifyAccessToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
exports.JWTPayloadSchema = zod_1.z.object({
    sub: zod_1.z.string(),
    role: zod_1.z.enum(['STUDENT', 'TEACHER', 'ADMIN']),
});
function signAccessToken(input) {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret)
        throw new Error('JWT_ACCESS_SECRET is not set');
    return jsonwebtoken_1.default.sign(input, secret, { expiresIn: '15m' });
}
function signRefreshToken(input) {
    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret)
        throw new Error('JWT_REFRESH_SECRET is not set');
    return jsonwebtoken_1.default.sign(input, secret, { expiresIn: '30d' });
}
function verifyAccessToken(token) {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret)
        throw new Error('JWT_ACCESS_SECRET is not set');
    const decoded = jsonwebtoken_1.default.verify(token, secret);
    return exports.JWTPayloadSchema.parse(decoded);
}
