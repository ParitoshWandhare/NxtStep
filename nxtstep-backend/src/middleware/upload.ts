// ============================================================
// NxtStep — File Upload Middleware (Multer)
// ============================================================

import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import { Request } from 'express';
import { env } from '../config/env';

const ALLOWED_RESUME_TYPES = ['application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const ALLOWED_AUDIO_TYPES = ['audio/webm', 'audio/ogg', 'audio/wav', 'audio/mp4', 'audio/mpeg'];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, env.UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    cb(null, `${unique}${ext}`);
  },
});

const resumeFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  if (ALLOWED_RESUME_TYPES.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Only PDF and Word documents are allowed for resumes'));
};

const audioFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  if (ALLOWED_AUDIO_TYPES.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Only audio files are allowed'));
};

export const uploadResume = multer({
  storage,
  limits: { fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: resumeFilter,
}).single('resume');

export const uploadAudio = multer({
  storage,
  limits: { fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: audioFilter,
}).single('audio');
