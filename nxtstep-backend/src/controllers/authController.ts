import { Request, Response } from 'express';
import * as authService from '../services/authService';
import { sendSuccess, sendCreated, sendError } from '../utils/apiResponse';
import { AuthRequest } from '../middleware/auth';

export const signup = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await authService.signup(req.body);
    sendCreated(res, result, 'Account created successfully');
  } catch (err: unknown) {
    const error = err as { message?: string; statusCode?: number };
    sendError(res, error.message || 'Signup failed', error.statusCode || 500);
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await authService.login(req.body);
    sendSuccess(res, result, 'Login successful');
  } catch (err: unknown) {
    const error = err as { message?: string; statusCode?: number };
    sendError(res, error.message || 'Login failed', error.statusCode || 500);
  }
};

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    await authService.forgotPassword(req.body.email);
    sendSuccess(res, null, 'If that email exists, a reset link was sent');
  } catch (err: unknown) {
    const error = err as { message?: string };
    sendError(res, error.message || 'Request failed');
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    await authService.resetPassword(req.body.token, req.body.newPassword);
    sendSuccess(res, null, 'Password reset successfully');
  } catch (err: unknown) {
    const error = err as { message?: string; statusCode?: number };
    sendError(res, error.message || 'Reset failed', error.statusCode || 500);
  }
};

export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await authService.getProfile(req.user!.userId);
    sendSuccess(res, user);
  } catch (err: unknown) {
    const error = err as { message?: string; statusCode?: number };
    sendError(res, error.message || 'Failed to get profile', error.statusCode || 500);
  }
};

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await authService.updateProfile(req.user!.userId, req.body);
    sendSuccess(res, user, 'Profile updated');
  } catch (err: unknown) {
    const error = err as { message?: string; statusCode?: number };
    sendError(res, error.message || 'Update failed', error.statusCode || 500);
  }
};