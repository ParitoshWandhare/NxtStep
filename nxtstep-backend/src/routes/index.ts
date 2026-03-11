import { Router } from 'express';
import authRoutes from './auth.routes';
import interviewRoutes from './interview.routes';
import scoreRoutes from './score.routes';
import recommendRoutes from './recommend.routes';
import newsRoutes from './news.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/interview', interviewRoutes);
router.use('/score', scoreRoutes);
router.use('/recommend', recommendRoutes);
router.use('/news', newsRoutes);

export default router;