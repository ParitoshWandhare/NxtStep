// ============================================================
// NxtStep — Auth Controller
// ============================================================

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import * as authService from '../services/authService';
import { sendSuccess, sendCreated } from '../utils/apiResponse';

export const register = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, email, password, rolePreferences } = req.body;
    const result = await authService.registerUser(name, email, password, rolePreferences);
    sendCreated(res, result, result.message ?? 'Account created successfully');
  } catch (err) { next(err); }
};

export const login = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    const result = await authService.loginUser(email, password);
    sendSuccess(res, result, 'Logged in successfully');
  } catch (err) { next(err); }
};

export const verifyEmail = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await authService.verifyEmail(req.user!.userId, req.body.otp);
    sendSuccess(res, result, 'Email verified successfully');
  } catch (err) { next(err); }
};

export const resendOtp = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await authService.resendVerificationOtp(req.user!.userId);
    sendSuccess(res, null, result.message);
  } catch (err) { next(err); }
};

export const forgotPassword = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await authService.forgotPassword(req.body.email);
    sendSuccess(res, null, 'If that email exists, a reset link has been sent');
  } catch (err) { next(err); }
};

export const resetPassword = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await authService.resetPassword(req.body.token, req.body.password);
    sendSuccess(res, null, 'Password reset successfully');
  } catch (err) { next(err); }
};

export const getProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await authService.getProfile(req.user!.userId);
    sendSuccess(res, user);
  } catch (err) { next(err); }
};

export const updateSettings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await authService.updateProfile(req.user!.userId, req.body);
    sendSuccess(res, user, 'Settings updated');
  } catch (err) { next(err); }
};