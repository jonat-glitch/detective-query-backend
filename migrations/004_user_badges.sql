-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  Migration 004 — Persistent User Badges (user_badges table)       ║
-- ║  Replaces pure client-side achievement checking                    ║
-- ║  Badges are synced server-side on every profile load               ║
-- ╚════════════════════════════════════════════════════════════════════╝

-- Create the user_badges table to store unlocked badge IDs per student
CREATE TABLE IF NOT EXISTS user_badges (
    badge_id    VARCHAR(50)  NOT NULL,
    user_id     INT          NOT NULL,
    unlocked_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (badge_id, user_id),
    CONSTRAINT fk_user_badges_user FOREIGN KEY (user_id)
        REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE
);
