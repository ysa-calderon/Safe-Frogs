import express from 'express';
import {
    getLifelines,
    getLifelineById,
    createLifeline,
    updateLifeline,
    deleteLifeline,
    frogToLifeline,
} from '../controllers/lifelineController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// All routes require auth
router.use(authenticateToken);

// Routes for lifelines in section
router.get('/section/:sectionId', getLifelines);
router.post('/section/:sectionId', createLifeline);

// Routes for individual lifelines
router.get('/:id', getLifelineById);
router.put('/:id', updateLifeline);
router.delete('/:id', deleteLifeline);

// Frog to lifeline (restore section state)
router.post('/:id/frog', frogToLifeline);

export default router;