/**
 * Badge Definitions — single source of truth (shared by backend sync logic).
 * Each badge has an id, and a check function that receives the student's
 * profile stats + difficulty-progress rows and returns true when earned.
 *
 * These mirror the frontend BADGE_DEFS in AchievementsModal.tsx.
 */

const BADGE_DEFS = [
  {
    id: 'first_case',
    title: 'First Investigation',
    description: 'Complete your very first case.',
    check: (stats, _diff) => (stats.solved_cases || 0) >= 1,
  },
  {
    id: 'five_cases',
    title: 'Rising Detective',
    description: 'Solve 5 cases.',
    check: (stats, _diff) => (stats.solved_cases || 0) >= 5,
  },
  {
    id: 'ten_cases',
    title: 'Seasoned Investigator',
    description: 'Solve 10 cases.',
    check: (stats, _diff) => (stats.solved_cases || 0) >= 10,
  },
  {
    id: 'xp_500',
    title: 'XP Collector',
    description: 'Earn 500 XP.',
    check: (stats, _diff) => (stats.total_points || 0) >= 500,
  },
  {
    id: 'xp_1000',
    title: 'XP Master',
    description: 'Earn 1000 XP.',
    check: (stats, _diff) => (stats.total_points || 0) >= 1000,
  },
  {
    id: 'lvl5',
    title: 'Rank Up',
    description: 'Reach Level 5.',
    check: (stats, _diff) => (stats.current_level || 1) >= 5,
  },
  {
    id: 'beginner_done',
    title: 'Beginner Clear',
    description: 'Complete all Beginner cases.',
    check: (_stats, diff) => {
      const beg = diff.find(x => x.difficulty_name === 'Beginner');
      return !!(beg && beg.totalCases > 0 && beg.completed >= beg.totalCases);
    },
  },
  {
    id: 'intermediate_done',
    title: 'Intermediate Clear',
    description: 'Complete all Intermediate cases.',
    check: (_stats, diff) => {
      const lvl = diff.find(x => x.difficulty_name === 'Intermediate');
      return !!(lvl && lvl.totalCases > 0 && lvl.completed >= lvl.totalCases);
    },
  },
];

module.exports = { BADGE_DEFS };
