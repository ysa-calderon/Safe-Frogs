import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';

// Get all sections for a project
export const getSections = async (req: AuthRequest, res: Response) => {
    const { projectId } = req.params;

    try {
        // Make sure project belongs to user
        const projectCheck = await pool.query(
            'select * '
            + 'from projects '
            + 'where id = $1 and user_id = $2',
            [projectId, req.userId]
        );

        if (projectCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const result = await pool.query(
            'select * '
            + 'from sections '
            + 'where project_id = $1 '
            + 'order by created_at asc',
            [projectId]
        );

        res.json({ sections: result.rows });
    } catch (error) {
        console.error('Get sections error:', error);
        res.status(500).json({ error: 'Server error fetching sections' });
    }
};

// Get single section by ID
export const getSectionById = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    try {
        const result = await pool.query(
            'select s.* '
            + 'from sections s '
            + 'join projects p on s.project_id = p.id '
            + 'where s.id = $1 and p.user_id = $2',
            [id, req.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Section not found' });
        }

        res.json({ section: result.rows[0] });
    } catch (error) {
        console.error('Get section error:', error);
        res.status(500).json({ error: 'Server error fetching section' });
    }
};

// Create new section
export const createSection = async (req: AuthRequest, res: Response) => {
    const { projectId } = req.params;
    const { 
        name, 
        pattern_type, 
        starting_stitches, 
        stitch_change_per_row, 
        total_rows 
    } = req.body;

    try {
        // Verify project exists and belongs to user
        const projectCheck = await pool.query(
            'select id '
            + 'from projects '
            + 'where id = $1 and user_id = $2',
            [projectId, req.userId]
        );

        if (projectCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }

        if (!name || !starting_stitches || !total_rows) {
            return res.status(400).json({ 
                error: 'Name, starting_stitches, and total_rows are required' 
            });
        }

        const result = await pool.query(
            'insert into sections '
            + '(project_id, name, pattern_type, starting_stitches, stitch_change_per_row, total_rows) '
            + 'values ($1, $2, $3, $4, $5, $6) '
            + 'returning *',
            [
                projectId, 
                name, 
                pattern_type || 'fixed', 
                starting_stitches, 
                stitch_change_per_row || 0, 
                total_rows,
            ]
        );

        res.status(201).json({
            message: 'Section created successfully',
            section: result.rows[0],
        });
    } catch (error) {
        console.error('Create section error:', error);
        res.status(500).json({ error: 'Server error creating section' });
    }
};

// Update section
export const updateSection = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const {
        name,
        pattern_type,
        starting_stitches,
        stitch_change_per_row,
        total_rows,
        current_row,
    } = req.body;

    try {
        // Verify section belongs to user's project
        const checkResult = await pool.query(
            'select s.* '
            + 'from sections s '
            + 'join projects p on s.project_id = p.id '
            + 'where s.id = $1 and p.user_id = $2',
            [id, req.userId]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Section not found' });
        }

        const result = await pool.query(
            'update sections '
            + 'set name = $1, pattern_type = $2, starting_stitches = $3, '
            + 'stitch_change_per_row = $4, total_rows = $5, current_row = $6, '
            + 'updated_at = now() '
            + 'where id = $7 '
            + 'returning *',
            [
                name,
                pattern_type,
                starting_stitches,
                stitch_change_per_row,
                total_rows,
                current_row,
                id,
            ]
        );

        res.json({
            message: 'Section updated successfully',
            section: result.rows[0],
        });
    } catch (error) {
        console.error('Update section error:', error);
        res.status(500).json({ error: 'Server error updating section' });
    }
};

// Delete section
export const deleteSection = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    try {
        const result = await pool.query(
            'delete '
            + 'from sections s '
            + 'using projects p '
            + 'where s.id = $1 and s.project_id = p.id and p.user_id = $2 '
            + 'returning s.*',
            [id, req.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Section not found' });
        }

        res.json({ message: 'Section deleted successfully' });
    } catch (error) {
        console.error('Delete section error:', error);
        res.status(500).json({ error: 'Server error deleting section' });
    }
};

// Increment counter (row or stitch)
export const incrementCounter = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { type } = req.body; // 'row' or 'stitch'

    try {
        // Get current section
        const sectionResult = await pool.query(
            'select s.* '
            + 'from sections s '
            + 'join projects p on s.project_id = p.id '
            + 'where s.id = $1 and p.user_id = $2',
            [id, req.userId]
        );

        if (sectionResult.rows.length === 0) {
            return res.status(404).json({ error: 'Section not found' });
        }

        const section = sectionResult.rows[0];

        if (type === 'row') {
            // Increment row
            const newRow = section.current_row + 1;

            if (newRow > section.total_rows) {
                return res.status(400).json({ error: 'Cannot exceed total rows' });
            }

            const result = await pool.query(
                'update sections '
                + 'set current_row = $1, updated_at = now() '
                + 'where id = $2 '
                + 'returning *',
                [newRow, id]
            );

            res.json({
                message: 'Row incremented',
                section: result.rows[0],
            });
        } else {
            return res.status(400).json({ error: 'Invalid increment type' });
        }
    } catch (error) {
        console.error('Increment counter error:', error);
        res.status(500).json({ error: 'Server error incrementing counter' });
    }
};