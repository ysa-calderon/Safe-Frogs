import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';

// Get all lifelines for a section
export const getLifelines = async (req: AuthRequest, res: Response) => {
    const { sectionId } = req.params;
    
    try {
        //Verify section belongs to user's project
        const sectionCheck = await pool.query(
            'select s.* '
            + 'from sections s '
            + 'join projects p on s.project_id = p.id '
            + 'where s.id = $1 and p.user_id = $2',
            [sectionId, req.userId]
        );

        if (sectionCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Section not found' });
        }

        const result = await pool.query(
            'select * '
            + 'from lifelines '
            + 'where section_id = $1 '
            + 'order by created_at desc',
            [sectionId]
        );

        res.json({ lifelines: result.rows });
    } catch (error) {
        console.error('Get lifelines error:', error);
        res.status(500).json({ error: 'Server error fetching lifelines' });
    }
};

// Get single lifeline by ID
export const getLifelineById = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    try {
        const result = await pool.query(
            'select l.* '
            + 'from lifelines l '
            + 'join sections s on l.section_id = s.id '
            + 'join projects p on s.project_id = p.id '
            + 'where l.id = $1 and p.user_id = $2',
            [id, req.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Lifeline not found' });
        }

        res.json({ lifeline: result.rows[0] });
    } catch (error) {
        console.error('Get lifeline error:', error);
        res.status(500).json({ error: 'Server error fetching lifeline' });
    }
};

// Create new lifeline (save current state as safety point)
export const createLifeline = async (req: AuthRequest, res: Response) => {
    const { sectionId } = req.params;
    const { name, notes } = req.body;

    try {
        // Get current section state
        const sectionResult = await pool.query(
            'select s.* '
            + 'from sections s '
            + 'join projects p on s.project_id = p.id '
            + 'where s.id = $1 and p.user_id = $2',
            [sectionId, req.userId]
        );

        if (sectionResult.rows.length === 0) {
            return res.status(404).json({ error: 'Section not found' });
        }

        const section = sectionResult.rows[0];

        // Calculate current stitch count based on pattern
        let currentStitches = section.starting_stitches;
        if (section.pattern_type !== 'fixed') {
            currentStitches = section.starting_stitches + (section.current_row * section.stitch_change_per_row);
        }

        // Create lifeline with current state
        const result = await pool.query(
            'insert into lifelines '
            + '(section_id, name, saved_row, saved_stitches, notes) '
            + 'values ($1, $2, $3, $4, $5) '
            + 'returning *',
            [
                sectionId,
                name || 'Lifeline at Row ${section.current_row}',
                section.current_row,
                currentStitches,
                notes || null,
            ]
        );

        res.status(201).json({
            message: 'Lifeline created successfully',
            lifeline: result.rows[0],
        });
    } catch (error) {
        console.error('Create lifeline error:', error);
        res.status(500).json({ error: 'Server error creating lifeline' });
    }
};

// Update lifeline (rename or add notes)
export const updateLifeline = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { name, notes } = req.body;

    try {
        // Verify lifeline belongs to user
        const checkResult = await pool.query(
            'select l.* '
            + 'from lifelines l '
            + 'join sections s on l.section_id = s.id '
            + 'join projects p on s.project_id = p.id '
            + 'where l.id = $1 and p.user_id = $2',
            [id, req.userId]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Lifeline not found' });
        }

        const result = await pool.query(
            'update lifelines '
            + 'set name = $1, notes = $2 '
            + 'where id = $3 '
            + 'returning *',
            [name, notes, id]
        );

        res.json({
            message: 'Lifeline updated successfully',
            lifeline: result.rows[0],
        });
    } catch (error) {
        console.error('Update lifeline error:', error);
        res.status(500).json({ error: 'Server error updating lifeline' });
    }
};

// Delete lifeline
export const deleteLifeline = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    try {
        const result = await pool.query(
            'delete from lifelines l '
            + 'using sections s, projects p '
            + 'where l.id = $1 '
            + 'and l.section_id = s.id '
            + 'and s.project_id = p.id '
            + 'and p.user_id = $2 '
            + 'returning l.*',
            [id, req.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Lifeline not found' });
        }

        res.json({ message: 'Lifeline deleted successfully' });
    } catch (error) {
        console.error('Delete lifeline error:', error);
        res.status(500).json({ error: 'Server error deleting lifeline' });
    }
};

// Frog to a lifeline (restore section to lifeline state)
export const frogToLifeline = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    try {
        // Get lifeline
        const lifelineResult = await pool.query(
            'select l.*, s.id as section_id '
            + 'from lifelines l '
            + 'join sections s on l.section_id = s.id '
            + 'join projects p on s.project_id = p.id '
            + 'where l.id = $1 and p.user_id = $2',
            [id, req.userId]
        );

        if (lifelineResult.rows.length === 0) {
            return res.status(404).json({ error: 'Lifeline not found' });
        }

        const lifeline = lifelineResult.rows[0];

        // Update section to lifeline's saved state
        const result = await pool.query(
            'update sections '
            + 'set current_row = $1, updated_at = now() '
            + 'where id = $2 '
            + 'returning *',
            [lifeline.saved_row, lifeline.section_id]
        );

        res.json({
            message: 'Frogged to lifeline successfully',
            section: result.rows[0],
            lifeline: {
                id: lifeline.id,
                name: lifeline.name,
                saved_row: lifeline.saved_row,
                saved_stitches: lifeline.saved_stitches,
            },
        });
    } catch (error) {
        console.error('Frog to lifeline error:', error);
        res.status(500).json({ error: 'Server error frogging to lifeline' });
    }
};