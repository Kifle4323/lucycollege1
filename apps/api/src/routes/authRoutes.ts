import type { Request, Response, Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db.js';
import { signAccessToken, signRefreshToken } from '../auth.js';
import { authRequired, requireRole, type AuthedRequest } from '../middleware.js';

export function registerAuthRoutes(router: Router) {
  router.post('/auth/register', async (req: Request, res: Response) => {
    const body = z
      .object({
        email: z.string().email(),
        password: z.string().min(6),
        fullName: z.string().min(2),
        role: z.enum(['STUDENT', 'TEACHER', 'ADMIN']).optional(),
      })
      .parse(req.body);

    const passwordHash = await bcrypt.hash(body.password, 10);

    const user = await prisma.user.create({
      data: {
        email: body.email.toLowerCase(),
        passwordHash,
        fullName: body.fullName,
        role: body.role ?? 'STUDENT',
      },
      select: { id: true, email: true, fullName: true, role: true, createdAt: true },
    });

    res.json(user);
  });

  // Admin creates user
  router.post('/admin/users', authRequired, requireRole(['ADMIN']), async (req: AuthedRequest, res: Response) => {
    const body = z
      .object({
        email: z.string().email(),
        password: z.string().min(6),
        fullName: z.string().min(2),
        role: z.enum(['STUDENT', 'TEACHER', 'ADMIN']),
      })
      .parse(req.body);

    // Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (existing) {
      res.status(400).json({ error: 'email_exists', message: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(body.password, 10);

    const user = await prisma.user.create({
      data: {
        email: body.email.toLowerCase(),
        passwordHash,
        fullName: body.fullName,
        role: body.role,
        isProfileComplete: true, // Admin created, so profile is complete
      },
      select: { id: true, email: true, fullName: true, role: true, createdAt: true },
    });

    res.json(user);
  });

  router.post('/auth/login', async (req: Request, res: Response) => {
    const body = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!user) {
      res.status(401).json({ error: 'invalid_credentials' });
      return;
    }

    const ok = await bcrypt.compare(body.password, user.passwordHash);
    if (!ok) {
      res.status(401).json({ error: 'invalid_credentials' });
      return;
    }

    const payload = { sub: user.id, role: user.role } as const;
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    res.json({
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role, isProfileComplete: user.isProfileComplete, profileImage: user.profileImage },
    });
  });

  router.get('/me', authRequired, async (req: AuthedRequest, res: Response) => {
    const id = req.user!.id;
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, fullName: true, role: true, isProfileComplete: true, profileImage: true, createdAt: true },
    });
    res.json(user);
  });

  // Change password
  router.post('/me/change-password', authRequired, async (req: AuthedRequest, res: Response) => {
    const body = z
      .object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(6),
      })
      .parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) {
      res.status(404).json({ error: 'user_not_found' });
      return;
    }

    // Verify current password
    const ok = await bcrypt.compare(body.currentPassword, user.passwordHash);
    if (!ok) {
      res.status(400).json({ error: 'invalid_password', message: 'Current password is incorrect' });
      return;
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(body.newPassword, 10);

    await prisma.user.update({
      where: { id: req.user!.id },
      data: { passwordHash },
    });

    res.json({ success: true, message: 'Password changed successfully' });
  });
}
