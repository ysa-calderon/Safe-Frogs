import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';

// Get all projects for a user
export const getProjects = async (req: AuthRequest, res: Response) => {
    try {
        const result = await pool.query(
            'select * ' 
            + 'from projects '
            + 'where user_id = $1 '
            + 'order by created_at desc',
            [req.userId]
        );

        res.json({ projects: result.rows });
    } catch (error) {
        console.error('Get projects error:', error);
        res.status(500).json({ error: 'Server error fetching projects' });
    }
};

// Get single project by ID
export const getProjectById = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    try {
        const result = await pool.query(
            'select * '
            + 'from projects '
            + 'where id = $1 and user_id = $2',
            [id, req.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }

        res.json({ project: result.rows[0] });
    } catch (error) {
        console.error('Get project error:', error);
        res.status(500).json({ error: 'Server error fetching project' });
    }
};

// Create new project
export const createProject = async (req: AuthRequest, res: Response) => {
    const { name, description } = req.body;

    try {
        if (!name) {
            return res.status(400).json({ error: 'Project name is required' });
        }

        const result = await pool.query(
            'insert into projects (user_id, name, description) '
            + 'values ($1, $2, $3) '
            + 'returning *',
            [req.userId, name, description || null]
        );

        res.status(201).json({
            message: 'Project created successfully',
            project: result.rows[0],
        });
    } catch (error) {
        console.error('Create project error:', error);
        res.status(500).json({ error: 'Server error creating project' });
    }
};

// Update project
export const updateProject = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { name, description } = req.body;

    try {
        // Check if project exists and belongs to user
        const checkResult = await pool.query(
            'select * '
            + 'from projects '
            + 'where id = $1 and user_id = $2',
            [id, req.userId]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const result = await pool.query(
            'update projects '
            + 'set name = $1, description = $2, updated_at = now() '
            + 'where id = $3 and user_id = $4 '
            + 'returning *',
            [name, description, id, req.userId]
        );

        res.json({
            message: 'Project updated successfully',
            project: result.rows[0],
        });
    } catch (error) {
        console.error('Update project error:', error);
        res.status(500).json({ error: 'Server error updating project' });
    }
};

// Delete project
export const deleteProject = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    try {
        const result = await pool.query(
            'delete '
            + 'from projects '
            + 'where id = $1 and user_id = $2 '
            + 'returning *',
            [id, req.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }

        res.json({ message: 'Project deleted successfully' });
    } catch (error) {
        console.error('Delete project error:', error);
        res.status(500).json({ error: 'Server error deleting project' });
    }
};