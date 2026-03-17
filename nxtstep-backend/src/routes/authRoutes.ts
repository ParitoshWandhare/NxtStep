// ============================================================
// NxtStep — Auth Routes
// ============================================================

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  validate,
  parseBodyIfNeeded,
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  updateSettingsSchema,
} from '../middleware/validate';
import { authLimiter, passwordResetLimiter } from '../middleware/rateLimiter';
import {
  register,
  login,
  verifyEmail,
  resendOtp,
  forgotPassword,
  resetPassword,
  getProfile,
  updateSettings,
} from '../controllers/authController';

const router = Router();

// ── Public ────────────────────────────────────────────────────
router.post('/register',       authLimiter,          parseBodyIfNeeded, validate(registerSchema),       register);
router.post('/login',          authLimiter,          parseBodyIfNeeded, validate(loginSchema),          login);
router.post('/forgot-password',passwordResetLimiter, parseBodyIfNeeded, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', passwordResetLimiter, parseBodyIfNeeded, validate(resetPasswordSchema),  resetPassword);

// ── Protected ─────────────────────────────────────────────────
router.post('/verify-email', authenticate, parseBodyIfNeeded, validate(verifyEmailSchema), verifyEmail);
router.post('/resend-otp',   authenticate, resendOtp);
router.get('/me',            authenticate, getProfile);
router.patch('/me',          authenticate, parseBodyIfNeeded, validate(updateSettingsSchema), updateSettings);

export default router;