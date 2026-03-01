require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { systemDB, playgroundDB } = require('./db');
const bcrypt = require('bcryptjs');
const submissionService = require('./services/submissionService');
const jwt = require('jsonwebtoken');
const { authenticateToken, authorizeRole } = require('./middleware/auth');
const { apiLimiter, loginLimiter } = require('./middleware/rateLimiter');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const submissionRoutes = require('./routes/submissionRoutes');
const errorHandler = require('./middleware/errorHandler');
const progressRoutes = require("./routes/progressRoutes");
const difficultyProgressRoutes = require("./routes/difficultyProgressRoutes");
const adminRoutes = require("./routes/adminRoutes");

const JWT_SECRET = process.env.JWT_SECRET;

function validateStudentQuery(query) {
    if (!query || typeof query !== "string") {
        return "Invalid query format.";
    }

    const trimmed = query.trim();

    // Must start with SELECT (case insensitive)
    if (!/^select\s/i.test(trimmed)) {
        return "Only SELECT statements are allowed.";
    }

    // Block semicolons completely
    if (trimmed.includes(";")) {
        return "Multiple statements are not allowed.";
    }

    const lowerQuery = trimmed.toLowerCase();

    const forbiddenPatterns = [
        /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke)\b/,
        /\b(union)\b/,
        /\b(into\s+outfile)\b/,
        /\b(load_file)\b/,
        /\b(sleep|benchmark)\b/,
        /\b(information_schema|mysql|sys)\b/,
        /--/,          // inline comments
        /\/\*/,        // block comments
        /\b(select\s+.*\bselect\b)/ // nested SELECT (basic subquery block)
    ];

    for (let pattern of forbiddenPatterns) {
        if (pattern.test(lowerQuery)) {
            return "Query contains forbidden SQL pattern.";
        }
    }

    return null; // Safe
}

const app = express();

app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());
app.use(apiLimiter);
app.use(authRoutes);
app.use(userRoutes);
app.use(submissionRoutes);
app.use(errorHandler);
app.use("/progress", progressRoutes);
app.use("/difficulty-progress", difficultyProgressRoutes);
app.use("/admin", adminRoutes);

app.get('/', (req, res) => {
    res.send('Detective Query Backend is Running');
});

// Get all users
app.get('/users',
    authenticateToken,
    authorizeRole([3]), // Admin only
    async (req, res) => {

        try {
            const sql = `
            SELECT u.user_id, u.full_name, u.email, u.role_id, up.total_xp
            FROM users u
            LEFT JOIN user_progress up ON u.user_id = up.user_id
            `;

            const [results] = await systemDB.query(sql);

            res.json(results);

        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Database query failed' });
        }
    }
);

app.get('/test-playground', async (req, res) => {
    try {
        const [rows] = await playgroundDB.query('SELECT * FROM dq_employees');
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Playground test failed' });
    }
});
  
app.post("/logout", authenticateToken, (req, res) => {
  // For now, JWT is stateless
  // We just confirm logout on client side

  res.json({ message: "Logged out successfully" });
});
  
const PORT = 5000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});