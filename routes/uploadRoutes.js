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

            // Save to database
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
router.get('/upload/study-materials-all', authenticateToken, (req, res) => {
    try {
        const files = fs.readdirSync(uploadsDir);
        const map = {};
        files.forEach(file => {
            const match = file.match(/^study-material-(\d+)\.pdf$/);
            if (match) {
                const caseId = Number(match[1]);
                map[caseId] = `${req.protocol}://${req.get('host')}/uploads/${file}`;
            }
        });
        res.json({ materials: map });
    } catch (err) {
        res.json({ materials: {} });
    }
});

// 📚 Check / Get Study Material for a Single Case
router.get('/upload/study-material/:case_id', authenticateToken, (req, res) => {
    const caseId = req.params.case_id;
    const pdfPath = path.join(uploadsDir, `study-material-${caseId}.pdf`);

    if (!fs.existsSync(pdfPath)) {
        return res.json({ exists: false, pdfUrl: null });
    }

    const pdfUrl = `${req.protocol}://${req.get('host')}/uploads/study-material-${caseId}.pdf`;
    res.json({ exists: true, pdfUrl });
});

// 📚 Upload Study Material PDF (Teachers & Admins Only)
router.post('/upload/study-material/:case_id', authenticateToken, authorizeRole([2, 3]), (req, res) => {
    const caseId = req.params.case_id;

    // Delete existing PDF if any to avoid collision
    const pdfPath = path.join(uploadsDir, `study-material-${caseId}.pdf`);
    if (fs.existsSync(pdfPath)) {
        try {
            fs.unlinkSync(pdfPath);
        } catch (err) {
            console.error(`Failed to delete old PDF ${pdfPath}:`, err);
        }
    }

    upload.single('pdf')(req, res, (err) => {
        if (err) {
            return res.status(400).json({ error: err.message });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        res.json({
            message: 'Study material uploaded successfully',
            pdfUrl: `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`
        });
    });
});

module.exports = router;
