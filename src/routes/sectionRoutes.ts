import express from 'express';
import {
    getSections, 
    getSectionById, 
    createSection,
    updateSection,
    deleteSection,
    incrementCounter,
    undoCounter,
    frogByAmount,
} from '../controllers/sectionController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// All routes require auth
router.use(authenticateToken);

// Routes for sections within a project
router.get('/project/:projectId', getSections);
router.post('/project/:projectId', createSection);

// Routes for individual sections
router.get('/:id', getSectionById);
router.put('/:id', updateSection);
router.delete('/:id', deleteSection);

// Counter operations
router.post('/:id/increment', incrementCounter);
router.post('/:id/undo', undoCounter);
router.post('/:id/frog', frogByAmount);

export default router;