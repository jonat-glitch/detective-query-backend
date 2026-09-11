const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { systemDB } = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const router = express.Router();

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        if (file.fieldname === 'avatar') {
            const userId = req.user.user_id;
            const ext = path.extname(file.originalname);
            cb(null, `avatar-${userId}${ext}`);
        } else if (file.fieldname === 'pdf') {
            const caseId = req.params.case_id;
            cb(null, `study-material-${caseId}.pdf`);
        } else {
            cb(new Error('Invalid field name'));
        }
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.fieldname === 'avatar') {
            const allowedTypes = /jpeg|jpg|png/;
            const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
            const mimetype = allowedTypes.test(file.mimetype);
            if (extname && mimetype) {
                return cb(null, true);
            }
            cb(new Error('Only images (jpg, jpeg, png) are allowed for avatars.'));
        } else if (file.fieldname === 'pdf') {
            if (file.mimetype === 'application/pdf' || path.extname(file.originalname).toLowerCase() === '.pdf') {
                return cb(null, true);
            }
            cb(new Error('Only PDF files are allowed for study materials.'));
        } else {
            cb(new Error('Unknown upload field.'));
        }
    }
});

// 👤 Upload Avatar (Authenticated Users)
router.post('/upload/avatar', authenticateToken, (req, res) => {
    // Helper to clean up existing avatar files with different extensions before uploading
    const userId = req.user.user_id;
    const extensions = ['.png', '.jpg', '.jpeg'];
    extensions.forEach(ext => {
        const filePath = path.join(uploadsDir, `avatar-${userId}${ext}`);
        if (fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
            } catch (err) {
                console.error(`Failed to delete old avatar ${filePath}:`, err);
            }
        }
    });

    upload.single('avatar')(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ error: err.message });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        try {
            const avatarUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
            const fileBuffer = fs.readFileSync(req.file.path);
            const ext = path.extname(req.file.originalname).toLowerCase();
            const mime = ext === '.png' ? 'image/png' : 'image/jpeg';

            // 1. Save to persistent TiDB storage
            await systemDB.query(`
                INSERT INTO user_avatars (user_id, file_name, mime_type, file_size, file_data)
                VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    file_name = VALUES(file_name),
                    mime_type = VALUES(mime_type),
                    file_size = VALUES(file_size),
                    file_data = VALUES(file_data),
                    updated_at = CURRENT_TIMESTAMP
            `, [userId, req.file.filename, mime, fileBuffer.length, fileBuffer]);

            // 2. Save URL to users table
            await systemDB.query(
                'UPDATE users SET avatar = ? WHERE user_id = ?',
                [avatarUrl, userId]
            );

            res.json({
                message: 'Avatar uploaded successfully',
                avatarUrl: avatarUrl
            });

        } catch (error) {
            console.error('Avatar DB update error:', error);
            res.status(500).json({ error: 'Database update failed' });
        }
    });
});

// 📚 Get All Study Materials Map (Batch Endpoint for Teacher Tab)
router.get('/upload/study-materials-all', authenticateToken, async (req, res) => {
    try {
        const map = {};

        // 1. Query persistent TiDB storage
        const [rows] = await systemDB.query(
            'SELECT case_id, file_name FROM case_study_materials'
        );
        rows.forEach(r => {
            map[r.case_id] = `${req.protocol}://${req.get('host')}/uploads/study-material-${r.case_id}.pdf`;
        });

        // 2. Fallback / merge local disk files
        if (fs.existsSync(uploadsDir)) {
            const files = fs.readdirSync(uploadsDir);
            files.forEach(file => {
                const match = file.match(/^study-material-(\d+)\.pdf$/i);
                if (match) {
                    const caseId = Number(match[1]);
                    if (!map[caseId]) {
                        map[caseId] = `${req.protocol}://${req.get('host')}/uploads/${file}`;
                    }
                }
            });
        }

        res.json({ materials: map });
    } catch (err) {
        console.error('Error in study-materials-all:', err);
        res.json({ materials: {} });
    }
});

// 📚 Check / Get Study Material for a Single Case
router.get('/upload/study-material/:case_id', authenticateToken, async (req, res) => {
    try {
        const caseId = req.params.case_id;

        // 1. Check TiDB
        const [rows] = await systemDB.query(
            'SELECT case_id FROM case_study_materials WHERE case_id = ?',
            [caseId]
        );

        const pdfPath = path.join(uploadsDir, `study-material-${caseId}.pdf`);
        const exists = rows.length > 0 || fs.existsSync(pdfPath);

        if (!exists) {
            return res.json({ exists: false, pdfUrl: null });
        }

        const pdfUrl = `${req.protocol}://${req.get('host')}/uploads/study-material-${caseId}.pdf`;
        res.json({ exists: true, pdfUrl });
    } catch (err) {
        console.error('Error checking study material:', err);
        res.status(500).json({ error: 'Failed to check study material' });
    }
});

// 📚 Direct Download/View Endpoint for Study Material PDF
router.get('/upload/study-material-file/:case_id', async (req, res) => {
    try {
        const caseId = req.params.case_id;
        const [rows] = await systemDB.query(
            'SELECT file_name, mime_type, file_data FROM case_study_materials WHERE case_id = ?',
            [caseId]
        );
        if (rows.length > 0 && rows[0].file_data) {
            const cachedPath = path.join(uploadsDir, `study-material-${caseId}.pdf`);
            try { fs.writeFileSync(cachedPath, rows[0].file_data); } catch (e) {}

            res.setHeader('Content-Type', rows[0].mime_type || 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="${rows[0].file_name || `study-material-${caseId}.pdf`}"`);
            return res.send(rows[0].file_data);
        }

        const pdfPath = path.join(uploadsDir, `study-material-${caseId}.pdf`);
        if (fs.existsSync(pdfPath)) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="study-material-${caseId}.pdf"`);
            return res.sendFile(pdfPath);
        }

        return res.status(404).json({ error: 'Study material not found' });
    } catch (err) {
        console.error('Error serving study material file:', err);
        res.status(500).json({ error: 'Failed to retrieve study material file' });
    }
});

// 📚 Upload Study Material PDF (Teachers & Admins Only)
router.post('/upload/study-material/:case_id', authenticateToken, authorizeRole([2, 3]), (req, res) => {
    const caseId = req.params.case_id;

    // Delete existing local PDF if any
    const pdfPath = path.join(uploadsDir, `study-material-${caseId}.pdf`);
    if (fs.existsSync(pdfPath)) {
        try {
            fs.unlinkSync(pdfPath);
        } catch (err) {
            console.error(`Failed to delete old PDF ${pdfPath}:`, err);
        }
    }

    upload.single('pdf')(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ error: err.message });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        try {
            const fileBuffer = fs.readFileSync(req.file.path);

            // Persist to TiDB
            await systemDB.query(`
                INSERT INTO case_study_materials (case_id, file_name, mime_type, file_size, file_data, uploaded_by)
                VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    file_name = VALUES(file_name),
                    mime_type = VALUES(mime_type),
                    file_size = VALUES(file_size),
                    file_data = VALUES(file_data),
                    uploaded_by = VALUES(uploaded_by),
                    updated_at = CURRENT_TIMESTAMP
            `, [
                caseId,
                req.file.originalname || `study-material-${caseId}.pdf`,
                req.file.mimetype || 'application/pdf',
                fileBuffer.length,
                fileBuffer,
                req.user.user_id
            ]);

            res.json({
                message: 'Study material uploaded successfully',
                pdfUrl: `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`
            });
        } catch (dbErr) {
            console.error('Failed to save study material to database:', dbErr);
            res.status(500).json({ error: 'Database save failed for study material' });
        }
    });
});

// 📚 Delete Study Material (Teachers & Admins Only)
router.delete('/upload/study-material/:case_id', authenticateToken, authorizeRole([2, 3]), async (req, res) => {
    try {
        const caseId = req.params.case_id;
        await systemDB.query('DELETE FROM case_study_materials WHERE case_id = ?', [caseId]);
        const pdfPath = path.join(uploadsDir, `study-material-${caseId}.pdf`);
        if (fs.existsSync(pdfPath)) {
            try { fs.unlinkSync(pdfPath); } catch (e) {}
        }
        res.json({ message: 'Study material deleted successfully' });
    } catch (err) {
        console.error('Delete study material error:', err);
        res.status(500).json({ error: 'Failed to delete study material' });
    }
});

module.exports = router;
