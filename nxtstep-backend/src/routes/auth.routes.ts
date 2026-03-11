import { Router } from 'express';
import { z } from 'zod';
import * as authController from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { authLimiter } from '../middleware/rateLimiter';

const router = Router();

const signupSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  rolePreferences: z.array(z.string()).optional(),
  interests: z.array(z.string()).optional(),
  resumeUrl: z.string().url().optional(),
  resumeText: z.string().max(10000).optional(),
});

router.post('/signup', authLimiter, validate(signupSchema), authController.signup);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), authController.resetPassword);

router.get('/me', authenticate, authController.getProfile);
router.patch('/me', authenticate, validate(updateProfileSchema), authController.updateProfile);

export default router;