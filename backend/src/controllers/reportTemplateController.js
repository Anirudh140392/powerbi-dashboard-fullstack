import { isAdmin, resolveDbId, userEmail } from '../helper/workspaceHelper.js';
import {
    createTemplate, deleteTemplate, getTemplate, listTemplates, markTemplateUsed, TemplateValidationError, toClient, updateTemplate,
} from '../services/reportTemplateService.js';

/** The template, if the user can see it: theirs, or shared in their workspace. */
const loadVisible = async (req, res) => {
    const [template, dbId] = await Promise.all([getTemplate(req.params.id), resolveDbId(req.user)]);
    const visible = template && template.db_id === dbId && (template.visibility === 'workspace' || template.created_by === userEmail(req.user));
    if (!visible) {
        res.status(404).json({ success: false, error: 'Template not found' });
        return null;
    }
    return template;
};

/** The template, if the user may change it: its owner, or an admin for a shared one. */
const loadManageable = async (req, res) => {
    const template = await loadVisible(req, res);
    if (!template) return null;
    if (template.created_by !== userEmail(req.user) && !isAdmin(req.user)) {
        res.status(403).json({ success: false, error: 'Only the person who saved this template or an admin can change it' });
        return null;
    }
    return template;
};

const handleError = (res, label, error) => {
    if (error instanceof TemplateValidationError) return res.status(400).json({ success: false, error: error.message });
    console.error(`[ReportTemplate] ${label} failed:`, error.message);
    return res.status(500).json({ success: false, error: `Failed to ${label}` });
};

/** GET /api/report-templates */
export const listTemplatesHandler = async (req, res) => {
    try {
        const dbId = await resolveDbId(req.user);
        if (!dbId) return res.status(400).json({ success: false, error: 'No workspace selected' });
        const templates = await listTemplates(dbId, userEmail(req.user));
        res.json({ success: true, data: templates.map(toClient) });
    } catch (error) {
        handleError(res, 'load templates', error);
    }
};

/** POST /api/report-templates */
export const createTemplateHandler = async (req, res) => {
    try {
        const dbId = await resolveDbId(req.user);
        if (!dbId) return res.status(400).json({ success: false, error: 'No workspace selected' });
        const template = await createTemplate({ user: req.user, dbId, body: req.body });
        res.status(201).json({ success: true, data: toClient(template) });
    } catch (error) {
        handleError(res, 'save the template', error);
    }
};

/** PUT /api/report-templates/:id — any of name, description, visibility, config. */
export const updateTemplateHandler = async (req, res) => {
    try {
        const template = await loadManageable(req, res);
        if (!template) return;
        res.json({ success: true, data: toClient(await updateTemplate(template, req.body || {})) });
    } catch (error) {
        handleError(res, 'update the template', error);
    }
};

/** DELETE /api/report-templates/:id */
export const deleteTemplateHandler = async (req, res) => {
    try {
        const template = await loadManageable(req, res);
        if (!template) return;
        await deleteTemplate(template);
        res.json({ success: true });
    } catch (error) {
        handleError(res, 'delete the template', error);
    }
};

/** POST /api/report-templates/:id/used — counts an apply, so the most used templates come first. */
export const markTemplateUsedHandler = async (req, res) => {
    try {
        const template = await loadVisible(req, res);
        if (!template) return;
        await markTemplateUsed(template);
        res.json({ success: true });
    } catch (error) {
        handleError(res, 'record the template use', error);
    }
};
