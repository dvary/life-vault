const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticateToken, authorizeFamilyMember, requireAdmin, authorizeOwnDataOrAdmin } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_PATH || '/app/uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Sanitize original filename and preserve it with unique suffix to avoid conflicts
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const sanitizedName = file.originalname
      .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace special chars with underscore
      .replace(/_{2,}/g, '_') // Replace multiple underscores with single
      .substring(0, 200); // Limit length
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(sanitizedName, ext);
    cb(null, `${nameWithoutExt}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 20 * 1024 * 1024 // 20MB default
  },
  fileFilter: (req, file, cb) => {
    // Enhanced PDF validation: check both MIME type and extension
    const isPdf = file.mimetype === 'application/pdf' && path.extname(file.originalname).toLowerCase() === '.pdf';
    
    // Additional security: check file signature
    if (isPdf) {
      return cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

// Health Vitals Routes

// Get vitals for a family member
router.get('/vitals/:memberId', [authenticateToken, authorizeOwnDataOrAdmin], async (req, res) => {
  try {
    if (!req.user || !req.user.family_id) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'User not authenticated or family not found' 
      });
    }
    const { memberId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const result = await query(
      `SELECT 
        id, 
        member_id, 
        vital_type, 
        value, 
        unit, 
        notes, 
        recorded_at,
        created_at
      FROM health_vitals 
      WHERE member_id = $1 
      ORDER BY recorded_at DESC 
      LIMIT $2 OFFSET $3`,
      [memberId, parseInt(limit), parseInt(offset)]
    );

    // Get count for pagination
    const countResult = await query(
      'SELECT COUNT(*) as total FROM health_vitals WHERE member_id = $1',
      [memberId]
    );

    res.json({
      vitals: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Get vitals error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch vitals', 
      message: 'Could not retrieve health vitals' 
    });
  }
});

// Add new vital
router.post('/vitals', [
  authenticateToken,
  body('memberId').isUUID(),
  body('vitalType').isIn([
    'height', 'weight', 'cholesterol', 'hemoglobin', 'sgpt', 'sgot', 'vitamin_d', 'thyroid_tsh', 
    'thyroid_t3', 'thyroid_t4', 'vitamin_b12', 'calcium', 'hba1c', 'urea', 'fasting_blood_glucose', 'creatinine'
  ]),
  body('value').isNumeric(),
  body('unit').notEmpty().trim(),
  body('notes').optional().trim(),
  body('recordedAt').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const { memberId, vitalType, value, unit, notes, recordedAt } = req.body;

    // Check if member belongs to family
    const memberCheck = await query(
      'SELECT id FROM family_members WHERE id = $1 AND family_id = $2',
      [memberId, req.user.family_id]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ 
        error: 'Access denied', 
        message: 'You can only add vitals for your family members' 
      });
    }

    // Check for duplicate submission (same vital type for same member within 5 seconds)
    const fiveSecondsAgo = new Date(Date.now() - 5000);
    const duplicateCheck = await query(
      `SELECT id FROM health_vitals 
       WHERE member_id = $1 AND vital_type = $2 AND value = $3 AND unit = $4 
       AND created_at > $5`,
      [memberId, vitalType, value, unit, fiveSecondsAgo]
    );

    if (duplicateCheck.rows.length > 0) {
      return res.status(409).json({ 
        error: 'Duplicate submission', 
        message: 'This vital has already been added recently. Please wait a moment before trying again.' 
      });
    }

    const result = await query(
      `INSERT INTO health_vitals 
        (member_id, vital_type, value, unit, notes, recorded_at) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id, member_id, vital_type, value, unit, notes, recorded_at, created_at`,
      [memberId, vitalType, value, unit, notes, recordedAt || new Date()]
    );

    res.status(201).json({
      message: 'Vital added successfully',
      vital: result.rows[0]
    });
  } catch (error) {
    console.error('Add vital error:', error);
    res.status(500).json({ 
      error: 'Failed to add vital', 
      message: 'Could not add health vital' 
    });
  }
});

// Update vital
router.put('/vitals/:vitalId', [
  authenticateToken,
  body('vitalType').optional().isIn([
    'height', 'weight', 'cholesterol', 'hemoglobin', 'sgpt', 'sgot', 'vitamin_d', 'thyroid_tsh', 
    'thyroid_t3', 'thyroid_t4', 'vitamin_b12', 'calcium', 'hba1c', 'urea', 'fasting_blood_glucose', 'creatinine'
  ]),
  body('value').optional().isNumeric(),
  body('unit').optional().notEmpty().trim(),
  body('notes').optional().trim(),
  body('recordedAt').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const { vitalId } = req.params;
    const { vitalType, value, unit, notes, recordedAt } = req.body;

    // Check if vital exists and belongs to user's family
    const checkResult = await query(
      `SELECT hv.id FROM health_vitals hv 
       JOIN family_members fm ON hv.member_id = fm.id 
       WHERE hv.id = $1 AND fm.family_id = $2`,
      [vitalId, req.user.family_id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Vital not found', 
        message: 'Vital does not exist' 
      });
    }

    // Build update query
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    if (vitalType !== undefined) {
      updateFields.push(`vital_type = $${paramCount++}`);
      updateValues.push(vitalType);
    }
    if (value !== undefined) {
      updateFields.push(`value = $${paramCount++}`);
      updateValues.push(value);
    }
    if (unit !== undefined) {
      updateFields.push(`unit = $${paramCount++}`);
      updateValues.push(unit);
    }
    if (notes !== undefined) {
      updateFields.push(`notes = $${paramCount++}`);
      updateValues.push(notes);
    }
    if (recordedAt !== undefined) {
      updateFields.push(`recorded_at = $${paramCount++}`);
      updateValues.push(recordedAt);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ 
        error: 'No fields to update', 
        message: 'Please provide at least one field to update' 
      });
    }

    updateValues.push(vitalId);

    const result = await query(
      `UPDATE health_vitals 
       SET ${updateFields.join(', ')}, updated_at = NOW() 
       WHERE id = $${paramCount++} 
       RETURNING id, member_id, vital_type, value, unit, notes, recorded_at, created_at, updated_at`,
      updateValues
    );

    res.json({
      message: 'Vital updated successfully',
      vital: result.rows[0]
    });
  } catch (error) {
    console.error('Update vital error:', error);
    res.status(500).json({ 
      error: 'Failed to update vital', 
      message: 'Could not update health vital' 
    });
  }
});

// Delete vital
router.delete('/vitals/:vitalId', [authenticateToken, requireAdmin], async (req, res) => {
  try {
    const { vitalId } = req.params;

    // Check if vital exists and belongs to user's family
    const checkResult = await query(
      `SELECT hv.id FROM health_vitals hv 
       JOIN family_members fm ON hv.member_id = fm.id 
       WHERE hv.id = $1 AND fm.family_id = $2`,
      [vitalId, req.user.family_id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Vital not found', 
        message: 'Vital does not exist' 
      });
    }

    await query('DELETE FROM health_vitals WHERE id = $1', [vitalId]);

    res.json({
      message: 'Vital deleted successfully'
    });
  } catch (error) {
    console.error('Delete vital error:', error);
    res.status(500).json({ 
      error: 'Failed to delete vital', 
      message: 'Could not delete health vital' 
    });
  }
});

// Medical Reports Routes

// Get medical reports for a family member
router.get('/reports/:memberId', [authenticateToken, authorizeOwnDataOrAdmin], async (req, res) => {
  try {
    const { memberId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const result = await query(
      `SELECT 
        id, 
        member_id, 
        report_type, 
        report_sub_type,
        title, 
        description, 
        file_path, 
        file_name,
        file_size,
        report_date,
        created_at
      FROM medical_reports 
      WHERE member_id = $1 
      ORDER BY report_date DESC, created_at DESC 
      LIMIT $2 OFFSET $3`,
      [memberId, parseInt(limit), parseInt(offset)]
    );

    // Get count for pagination
    const countResult = await query(
      'SELECT COUNT(*) as total FROM medical_reports WHERE member_id = $1',
      [memberId]
    );

    res.json({
      reports: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch reports', 
      message: 'Could not retrieve medical reports' 
    });
  }
});

// Upload medical report
router.post('/reports', [
  authenticateToken,
  upload.single('file'),
  body('memberId').isUUID(),
  body('reportType').isIn(['lab_report', 'prescription_consultation', 'vaccination', 'hospital_records']),
  body('reportSubType').optional().isString(),
  body('title').optional().trim(),
  body('description').optional().trim(),
  body('reportDate').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    if (!req.file) {
      return res.status(400).json({ 
        error: 'File required', 
        message: 'Please upload a file' 
      });
    }

    const { memberId, reportType, reportSubType, title, description, reportDate } = req.body;

    // Check if member belongs to family
    const memberCheck = await query(
      'SELECT id FROM family_members WHERE id = $1 AND family_id = $2',
      [memberId, req.user.family_id]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ 
        error: 'Access denied', 
        message: 'You can only upload reports for your family members' 
      });
    }

    // Use provided title or fall back to original filename without extension
    const reportTitle = title && title.trim() 
      ? title.trim() 
      : req.file.originalname.replace(/\.[^/.]+$/, '');
    
    // Preserve original filename for download
    const originalFileName = req.file.originalname;

    const result = await query(
      `INSERT INTO medical_reports 
        (member_id, report_type, report_sub_type, title, description, file_path, file_name, file_size, report_date) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING id, member_id, report_type, report_sub_type, title, description, file_path, file_name, file_size, report_date, created_at`,
      [
        memberId, 
        reportType, 
        reportSubType || null, 
        reportTitle, 
        description, 
        req.file.filename, 
        originalFileName, 
        req.file.size, 
        reportDate || new Date()
      ]
    );

    res.status(201).json({
      message: 'Medical report uploaded successfully',
      report: result.rows[0]
    });
  } catch (error) {
    console.error('Upload report error:', error);
    res.status(500).json({ 
      error: 'Failed to upload report', 
      message: 'Could not upload medical report' 
    });
  }
});

// Update medical report
router.put('/reports/:reportId', [
  authenticateToken,
  upload.single('file'),
  body('reportType').optional().isIn(['lab_report', 'prescription_consultation', 'vaccination', 'hospital_records']),
  body('reportSubType').optional().isString(),
  body('title').optional().notEmpty().trim(),
  body('description').optional().trim(),
  body('reportDate').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const { reportId } = req.params;
    const { reportType, reportSubType, title, description, reportDate } = req.body;

    // Check if report exists and belongs to user's family
    const checkResult = await query(
      `SELECT mr.id, mr.file_path, mr.file_name FROM medical_reports mr 
       JOIN family_members fm ON mr.member_id = fm.id 
       WHERE mr.id = $1 AND fm.family_id = $2`,
      [reportId, req.user.family_id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Report not found', 
        message: 'Report does not exist' 
      });
    }

    // Build update query
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    if (reportType !== undefined) {
      updateFields.push(`report_type = $${paramCount++}`);
      updateValues.push(reportType);
    }
    if (reportSubType !== undefined) {
      updateFields.push(`report_sub_type = $${paramCount++}`);
      updateValues.push(reportSubType);
    }
    if (title !== undefined) {
      updateFields.push(`title = $${paramCount++}`);
      updateValues.push(title);
    }
    if (description !== undefined) {
      updateFields.push(`description = $${paramCount++}`);
      updateValues.push(description);
    }
    if (reportDate !== undefined) {
      updateFields.push(`report_date = $${paramCount++}`);
      updateValues.push(reportDate);
    }

    // Handle file upload if provided
    if (req.file) {
      // Delete old file
      const oldFileName = checkResult.rows[0].file_path;
      const uploadDir = process.env.UPLOAD_PATH || '/app/uploads';
      const oldFilePath = path.join(uploadDir, oldFileName);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }

      updateFields.push(`file_path = $${paramCount++}`);
      updateValues.push(req.file.filename);
      updateFields.push(`file_name = $${paramCount++}`);
      updateValues.push(req.file.originalname);
      updateFields.push(`file_size = $${paramCount++}`);
      updateValues.push(req.file.size);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ 
        error: 'No fields to update', 
        message: 'Please provide at least one field to update' 
      });
    }

    updateValues.push(reportId);

    const result = await query(
      `UPDATE medical_reports 
       SET ${updateFields.join(', ')}, updated_at = NOW() 
       WHERE id = $${paramCount++} 
       RETURNING id, member_id, report_type, report_sub_type, title, description, file_path, file_name, file_size, report_date, created_at, updated_at`,
      updateValues
    );

    res.json({
      message: 'Medical report updated successfully',
      report: result.rows[0]
    });
  } catch (error) {
    console.error('Update report error:', error);
    res.status(500).json({ 
      error: 'Failed to update report', 
      message: 'Could not update medical report' 
    });
  }
});

// Delete medical report
router.delete('/reports/:reportId', [authenticateToken, requireAdmin], async (req, res) => {
  try {
    const { reportId } = req.params;

    // Check if report exists and belongs to user's family
    const checkResult = await query(
      `SELECT mr.id, mr.file_path FROM medical_reports mr 
       JOIN family_members fm ON mr.member_id = fm.id 
       WHERE mr.id = $1 AND fm.family_id = $2`,
      [reportId, req.user.family_id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Report not found', 
        message: 'Report does not exist' 
      });
    }

    // Delete file from filesystem
    const fileName = checkResult.rows[0].file_path;
    const uploadDir = process.env.UPLOAD_PATH || '/app/uploads';
    const filePath = path.join(uploadDir, fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await query('DELETE FROM medical_reports WHERE id = $1', [reportId]);

    res.json({
      message: 'Medical report deleted successfully'
    });
  } catch (error) {
    console.error('Delete report error:', error);
    res.status(500).json({ 
      error: 'Failed to delete report', 
      message: 'Could not delete medical report' 
    });
  }
});

// Download medical report
// View medical report (for PDFs in iframe)
router.get('/reports/:reportId/view', authenticateToken, async (req, res) => {
  try {
    const { reportId } = req.params;

    // Check if report exists and belongs to user's family
    const checkResult = await query(
      `SELECT mr.id, mr.file_path, mr.file_name FROM medical_reports mr 
       JOIN family_members fm ON mr.member_id = fm.id 
       WHERE mr.id = $1 AND fm.family_id = $2`,
      [reportId, req.user.family_id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Report not found', 
        message: 'Report does not exist' 
      });
    }

    const fileName = checkResult.rows[0].file_path;
    const originalName = checkResult.rows[0].file_name;
    const uploadDir = process.env.UPLOAD_PATH || '/app/uploads';
    const filePath = path.join(uploadDir, fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ 
        error: 'File not found', 
        message: 'Report file does not exist' 
      });
    }

    const ext = path.extname(originalName).toLowerCase();
    if (ext === '.pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      // Properly encode filename for Content-Disposition header
      const encodedFilename = encodeURIComponent(originalName);
      res.setHeader('Content-Disposition', `inline; filename="${originalName}"; filename*=UTF-8''${encodedFilename}`);
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      return res.sendFile(filePath);
    }
    
    // For non-PDF files, redirect to download
    return res.redirect(`/api/health/reports/${reportId}/download`);
  } catch (error) {
    console.error('View report error:', error);
    res.status(500).json({ 
      error: 'Failed to view report', 
      message: 'Could not view report file' 
    });
  }
});

router.get('/reports/:reportId/download', authenticateToken, async (req, res) => {
  try {
    const { reportId } = req.params;

    // Check if report exists and belongs to user's family
    const checkResult = await query(
      `SELECT mr.id, mr.file_path, mr.file_name FROM medical_reports mr 
       JOIN family_members fm ON mr.member_id = fm.id 
       WHERE mr.id = $1 AND fm.family_id = $2`,
      [reportId, req.user.family_id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Report not found', 
        message: 'Report does not exist' 
      });
    }

    const fileName = checkResult.rows[0].file_path;
    const originalName = checkResult.rows[0].file_name;
    const uploadDir = process.env.UPLOAD_PATH || '/app/uploads';
    const filePath = path.join(uploadDir, fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ 
        error: 'File not found', 
        message: 'Report file does not exist' 
      });
    }

    const ext = path.extname(originalName).toLowerCase();
    if (ext === '.pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      // Properly encode filename for Content-Disposition header
      const encodedFilename = encodeURIComponent(originalName);
      res.setHeader('Content-Disposition', `attachment; filename="${originalName}"; filename*=UTF-8''${encodedFilename}`);
      return res.sendFile(filePath);
    }
    return res.download(filePath, originalName);
  } catch (error) {
    console.error('Download report error:', error);
    res.status(500).json({ 
      error: 'Failed to download report', 
      message: 'Could not download medical report' 
    });
  }
});

// Health History Summary
router.get('/history/:memberId', [authenticateToken, authorizeOwnDataOrAdmin], async (req, res) => {
  try {
    const { memberId } = req.params;
    const { days = 30 } = req.query;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));

    // Get vitals summary
    const vitalsResult = await query(
      `SELECT 
        vital_type,
        COUNT(*) as count,
        AVG(CAST(value AS DECIMAL)) as avg_value,
        MIN(CAST(value AS DECIMAL)) as min_value,
        MAX(CAST(value AS DECIMAL)) as max_value,
        MIN(recorded_at) as first_recorded,
        MAX(recorded_at) as last_recorded
      FROM health_vitals 
      WHERE member_id = $1 AND recorded_at >= $2
      GROUP BY vital_type`,
      [memberId, cutoffDate]
    );

    // Get reports summary
    const reportsResult = await query(
      `SELECT 
        report_type,
        COUNT(*) as count,
        MIN(report_date) as first_report,
        MAX(report_date) as last_report
      FROM medical_reports 
      WHERE member_id = $1 AND report_date >= $2
      GROUP BY report_type`,
      [memberId, cutoffDate]
    );

    // Get recent vitals (last 10)
    const recentVitalsResult = await query(
      `SELECT vital_type, value, unit, recorded_at 
       FROM health_vitals 
       WHERE member_id = $1 
       ORDER BY recorded_at DESC 
       LIMIT 10`,
      [memberId]
    );

    // Get recent reports (last 5)
    const recentReportsResult = await query(
      `SELECT report_type, title, report_date 
       FROM medical_reports 
       WHERE member_id = $1 
       ORDER BY report_date DESC 
       LIMIT 5`,
      [memberId]
    );

    res.json({
      summary: {
        vitals: vitalsResult.rows,
        reports: reportsResult.rows
      },
      recent: {
        vitals: recentVitalsResult.rows,
        reports: recentReportsResult.rows
      },
      period: {
        days: parseInt(days),
        from: cutoffDate,
        to: new Date()
      }
    });
  } catch (error) {
    console.error('Health history error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch health history', 
      message: 'Could not retrieve health history' 
    });
  }
});

// Document Routes

// Get documents for a family member
router.get('/documents/:memberId', [
  authenticateToken
], async (req, res) => {
  try {
    const { memberId } = req.params;

    // Check if member belongs to family
    const memberCheck = await query(
      'SELECT id FROM family_members WHERE id = $1 AND family_id = $2',
      [memberId, req.user.family_id]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ 
        error: 'Access denied', 
        message: 'You can only access documents for your family members' 
      });
    }

    const result = await query(
      `SELECT id, member_id, title, description, file_path, file_name, file_size, upload_date, created_at 
       FROM documents 
       WHERE member_id = $1 
       ORDER BY upload_date DESC, created_at DESC`,
      [memberId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch documents', 
      message: 'Could not retrieve documents' 
    });
  }
});

// Upload document
router.post('/documents/:memberId', [
  authenticateToken,
  upload.single('file'),
  body('title').notEmpty().trim(),
  body('description').optional().trim(),
  body('uploadDate').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    if (!req.file) {
      return res.status(400).json({ 
        error: 'File required', 
        message: 'Please upload a PDF file' 
      });
    }

    // Check if file is PDF
    if (!req.file.mimetype.includes('pdf')) {
      return res.status(400).json({ 
        error: 'Invalid file type', 
        message: 'Only PDF files are allowed' 
      });
    }

    const { memberId } = req.params;
    const { title, description, uploadDate } = req.body;

    // Check if member belongs to family
    const memberCheck = await query(
      'SELECT id FROM family_members WHERE id = $1 AND family_id = $2',
      [memberId, req.user.family_id]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ 
        error: 'Access denied', 
        message: 'You can only upload documents for your family members' 
      });
    }

    const result = await query(
      `INSERT INTO documents 
        (member_id, title, description, file_path, file_name, file_size, upload_date) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING id, member_id, title, description, file_path, file_name, file_size, upload_date, created_at`,
      [
        memberId, 
        title, 
        description, 
        req.file.filename,
        req.file.originalname,
        req.file.size,
        uploadDate || new Date()
      ]
    );

    res.status(201).json({
      message: 'Document uploaded successfully',
      document: result.rows[0]
    });
  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({ 
      error: 'Failed to upload document', 
      message: 'Could not save document' 
    });
  }
});

// Get document file
router.get('/documents/file/:documentId', [
  authenticateToken
], async (req, res) => {
  try {
    const { documentId } = req.params;

    // Get document info and verify access
    const result = await query(
      `SELECT d.*, fm.family_id 
       FROM documents d
       JOIN family_members fm ON d.member_id = fm.id
       WHERE d.id = $1 AND fm.family_id = $2`,
      [documentId, req.user.family_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Document not found', 
        message: 'Document does not exist or you do not have access' 
      });
    }

    const document = result.rows[0];
    const uploadDir = process.env.UPLOAD_PATH || '/app/uploads';
    const filePath = path.join(uploadDir, document.file_path);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ 
        error: 'File not found', 
        message: 'Document file does not exist on server' 
      });
    }

    // Set appropriate headers and download
    const ext = path.extname(document.file_name).toLowerCase();
    if (ext === '.pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      // Properly encode filename for Content-Disposition header
      const encodedFilename = encodeURIComponent(document.file_name);
      res.setHeader('Content-Disposition', `attachment; filename="${document.file_name}"; filename*=UTF-8''${encodedFilename}`);
      return res.sendFile(filePath);
    }
    return res.download(filePath, document.file_name);
  } catch (error) {
    console.error('Get document file error:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve document file', 
      message: 'Could not access document file' 
    });
  }
});

// Update document
router.put('/documents/:documentId', [
  authenticateToken,
  upload.single('file'),
  body('title').optional().notEmpty().trim(),
  body('description').optional().trim(),
  body('uploadDate').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const { documentId } = req.params;
    const { title, description, uploadDate } = req.body;

    // Check if document exists and belongs to user's family
    const checkResult = await query(
      `SELECT d.*, fm.family_id 
       FROM documents d
       JOIN family_members fm ON d.member_id = fm.id
       WHERE d.id = $1 AND fm.family_id = $2`,
      [documentId, req.user.family_id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Document not found', 
        message: 'Document does not exist or you do not have access' 
      });
    }

    // Build update query
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    if (title !== undefined) {
      updateFields.push(`title = $${paramCount++}`);
      updateValues.push(title);
    }
    if (description !== undefined) {
      updateFields.push(`description = $${paramCount++}`);
      updateValues.push(description);
    }
    if (uploadDate !== undefined) {
      updateFields.push(`upload_date = $${paramCount++}`);
      updateValues.push(uploadDate);
    }

    // Handle file upload if provided
    if (req.file) {
      // Check if file is PDF
      if (!req.file.mimetype.includes('pdf')) {
        return res.status(400).json({ 
          error: 'Invalid file type', 
          message: 'Only PDF files are allowed' 
        });
      }

      // Delete old file
      const oldFileName = checkResult.rows[0].file_path;
      const uploadDir = process.env.UPLOAD_PATH || '/app/uploads';
      const oldFilePath = path.join(uploadDir, oldFileName);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }

      updateFields.push(`file_path = $${paramCount++}`);
      updateValues.push(req.file.filename);
      updateFields.push(`file_name = $${paramCount++}`);
      updateValues.push(req.file.originalname);
      updateFields.push(`file_size = $${paramCount++}`);
      updateValues.push(req.file.size);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ 
        error: 'No fields to update', 
        message: 'Please provide at least one field to update' 
      });
    }

    updateValues.push(documentId);

    const result = await query(
      `UPDATE documents 
       SET ${updateFields.join(', ')}, updated_at = NOW() 
       WHERE id = $${paramCount++} 
       RETURNING id, member_id, title, description, file_path, file_name, file_size, upload_date, created_at, updated_at`,
      updateValues
    );

    res.json({
      message: 'Document updated successfully',
      document: result.rows[0]
    });
  } catch (error) {
    console.error('Update document error:', error);
    res.status(500).json({ 
      error: 'Failed to update document', 
      message: 'Could not update document' 
    });
  }
});

// Delete document
router.delete('/documents/:documentId', [
  authenticateToken,
  requireAdmin
], async (req, res) => {
  try {
    const { documentId } = req.params;

    // Check if document exists and belongs to user's family
    const checkResult = await query(
      `SELECT d.*, fm.family_id 
       FROM documents d
       JOIN family_members fm ON d.member_id = fm.id
       WHERE d.id = $1 AND fm.family_id = $2`,
      [documentId, req.user.family_id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Document not found', 
        message: 'Document does not exist or you do not have access' 
      });
    }

    const document = checkResult.rows[0];

    // Delete the file from filesystem
    const uploadDir = process.env.UPLOAD_PATH || '/app/uploads';
    const filePath = path.join(uploadDir, document.file_path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete from database
    await query(
      'DELETE FROM documents WHERE id = $1',
      [documentId]
    );

    res.json({
      message: 'Document deleted successfully'
    });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ 
      error: 'Failed to delete document', 
      message: 'Could not delete document' 
    });
  }
});

module.exports = router;
