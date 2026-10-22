/**
 * queryEvaluator.js
 *
 * Granular evaluator for student SQL queries (DDL, DML, DQL).
 * Instead of all-or-nothing binary checks, this module breaks down
 * student results against the expected blueprint, calculating:
 *   - percentage (0 - 100%)
 *   - stars (0, 1, 2, or 3)
 *   - score_awarded (based on base_points)
 *   - itemized checklist of passed vs missing criteria
 *   - student-friendly instructional feedback
 */

// Helper to normalize strings for comparison
function norm(str) {
    if (str === null || str === undefined) return '';
    return String(str).trim().toLowerCase();
}

/**
 * Normalizes SQL data types so minor differences (e.g. "int(11)" vs "int", "varchar(100)" vs "varchar(100)") match nicely.
 */
function normalizeType(typeStr) {
    let t = norm(typeStr).replace(/\s+/g, '');
    // Replace int(11) with int
    t = t.replace(/^int\(\d+\)/, 'int');
    t = t.replace(/^tinyint\(1\)/, 'tinyint(1)'); // boolean
    return t;
}

/**
 * Evaluates DDL column structures from SHOW COLUMNS FROM <table>
 */
function evaluateSchema(actualCols, expectedCols) {
    if (!Array.isArray(expectedCols) || expectedCols.length === 0) {
        return {
            percentage: 100,
            stars: 3,
            is_perfect: true,
            is_passing: true,
            checks: [],
            feedback: '✅ Schema verified.'
        };
    }

    if (!Array.isArray(actualCols) || actualCols.length === 0) {
        return {
            percentage: 0,
            stars: 0,
            is_perfect: false,
            is_passing: false,
            checks: [
                {
                    title: 'Table Existence',
                    passed: false,
                    detail: 'Table was not created or has no columns.'
                }
            ],
            feedback: '❌ The target table was not created or could not be found.'
        };
    }

    // Index actual columns by normalized field name
    const actualMap = new Map();
    for (const col of actualCols) {
        const fieldName = norm(col.Field || col.field || col.COLUMN_NAME || col.column_name);
        if (fieldName) {
            actualMap.set(fieldName, col);
        }
    }

    let totalPoints = 0;
    let earnedPoints = 0;
    const checks = [];
    const missingItems = [];
    const passedItems = [];

    for (const exp of expectedCols) {
        const field = norm(exp.Field || exp.field || exp.COLUMN_NAME || exp.column_name);
        const expType = normalizeType(exp.Type || exp.type || exp.DATA_TYPE || exp.data_type);
        const expNull = norm(exp.Null || exp.null || exp.IS_NULLABLE || exp.is_nullable);
        const expKey = norm(exp.Key || exp.key || exp.COLUMN_KEY || exp.column_key);
        const expDefault = exp.Default !== undefined ? exp.Default : exp.default;
        const expExtra = norm(exp.Extra || exp.extra);

        const act = actualMap.get(field);

        // 1. Column presence check (Weight: 25)
        totalPoints += 25;
        if (!act) {
            checks.push({
                title: `Column '${field}'`,
                passed: false,
                detail: `Missing required column '${field}'.`
            });
            missingItems.push(`Missing column '${field}' (${expType.toUpperCase()})`);
            continue; // Cannot evaluate properties if column doesn't exist
        } else {
            earnedPoints += 25;
            checks.push({
                title: `Column '${field}' created`,
                passed: true,
                detail: `Column '${field}' exists.`
            });
        }

        // 2. Data type check (Weight: 20)
        totalPoints += 20;
        const actType = normalizeType(act.Type || act.type || act.DATA_TYPE || act.data_type);
        // Direct match or base type match (e.g. varchar vs varchar(100))
        const typeMatched = (actType === expType) || 
            (expType.startsWith('varchar') && actType.startsWith('varchar') && actType === expType);
        
        if (typeMatched) {
            earnedPoints += 20;
            checks.push({
                title: `'${field}' Data Type`,
                passed: true,
                detail: `Type matches expected ${expType.toUpperCase()}.`
            });
        } else {
            // Partial credit if base type matches (e.g. int vs bigint, or varchar size difference)
            const baseExp = expType.split('(')[0];
            const baseAct = actType.split('(')[0];
            if (baseExp === baseAct) {
                earnedPoints += 10;
                checks.push({
                    title: `'${field}' Data Type`,
                    passed: false,
                    detail: `Type is ${actType.toUpperCase()} (expected ${expType.toUpperCase()}). Partial credit awarded.`
                });
                missingItems.push(`Column '${field}' type size mismatch (expected ${expType.toUpperCase()})`);
            } else {
                checks.push({
                    title: `'${field}' Data Type`,
                    passed: false,
                    detail: `Expected type ${expType.toUpperCase()}, but found ${actType.toUpperCase()}.`
                });
                missingItems.push(`Column '${field}' has wrong data type (expected ${expType.toUpperCase()})`);
            }
        }

        // 3. Primary Key / Key constraint check (Weight: 20 if required)
        if (expKey) {
            totalPoints += 20;
            const actKey = norm(act.Key || act.key || act.COLUMN_KEY || act.column_key);
            if (actKey === expKey || (expKey === 'pri' && actKey === 'pri')) {
                earnedPoints += 20;
                checks.push({
                    title: `'${field}' Key Constraint`,
                    passed: true,
                    detail: `Correctly configured as ${expKey.toUpperCase()}.`
                });
                passedItems.push(`'${field}' is ${expKey === 'pri' ? 'PRIMARY KEY' : expKey.toUpperCase()}`);
            } else {
                checks.push({
                    title: `'${field}' Key Constraint`,
                    passed: false,
                    detail: `Expected key constraint ${expKey.toUpperCase()} was not found.`
                });
                missingItems.push(`'${field}' is missing ${expKey === 'pri' ? 'PRIMARY KEY' : expKey.toUpperCase()}`);
            }
        }

        // 4. Auto Increment / Extra check (Weight: 15 if required)
        if (expExtra.includes('auto_increment')) {
            totalPoints += 15;
            const actExtra = norm(act.Extra || act.extra);
            if (actExtra.includes('auto_increment')) {
                earnedPoints += 15;
                checks.push({
                    title: `'${field}' AUTO_INCREMENT`,
                    passed: true,
                    detail: `AUTO_INCREMENT attribute is present.`
                });
                passedItems.push(`'${field}' is AUTO_INCREMENT`);
            } else {
                checks.push({
                    title: `'${field}' AUTO_INCREMENT`,
                    passed: false,
                    detail: `Expected AUTO_INCREMENT attribute on '${field}'.`
                });
                missingItems.push(`'${field}' is missing AUTO_INCREMENT`);
            }
        }

        // 5. NOT NULL constraint check (Weight: 10 if required)
        if (expNull === 'no') {
            totalPoints += 10;
            const actNull = norm(act.Null || act.null || act.IS_NULLABLE || act.is_nullable);
            if (actNull === 'no') {
                earnedPoints += 10;
                checks.push({
                    title: `'${field}' NOT NULL Constraint`,
                    passed: true,
                    detail: `NOT NULL is enforced.`
                });
            } else {
                checks.push({
                    title: `'${field}' NOT NULL Constraint`,
                    passed: false,
                    detail: `Column '${field}' must be NOT NULL.`
                });
                missingItems.push(`Column '${field}' missing NOT NULL constraint`);
            }
        }

        // 6. DEFAULT value check (Weight: 15 if required)
        if (expDefault !== null && expDefault !== undefined) {
            totalPoints += 15;
            const actDefault = act.Default !== undefined ? act.Default : act.default;
            const normExpDef = norm(expDefault);
            const normActDef = norm(actDefault);

            if (normExpDef === normActDef) {
                earnedPoints += 15;
                checks.push({
                    title: `'${field}' DEFAULT Value`,
                    passed: true,
                    detail: `Default value '${expDefault}' is correctly set.`
                });
                passedItems.push(`'${field}' has DEFAULT '${expDefault}'`);
            } else {
                checks.push({
                    title: `'${field}' DEFAULT Value`,
                    passed: false,
                    detail: `Expected DEFAULT '${expDefault}', but got '${actDefault || 'none'}'.`
                });
                missingItems.push(`Column '${field}' missing DEFAULT '${expDefault}'`);
            }
        }
    }

    const percentage = totalPoints > 0 ? Math.min(100, Math.round((earnedPoints / totalPoints) * 100)) : 100;
    
    // Star rating distribution
    let stars = 0;
    if (percentage === 100) {
        stars = 3;
    } else if (percentage >= 65) {
        stars = 2;
    } else if (percentage >= 25) {
        stars = 1;
    } else {
        stars = 0;
    }

    const is_perfect = percentage === 100;
    const is_passing = percentage >= 25;

    // Build user-friendly feedback string
    let feedback = '';
    if (is_perfect) {
        feedback = `🌟 Perfect Query! Blueprint 100% matched with all constraints.`;
    } else if (stars === 2) {
        feedback = `⭐ Good Progress (2 Stars - ${percentage}%)! Table and main structure created, but missing: ${missingItems.slice(0, 2).join(', ')}.`;
    } else if (stars === 1) {
        feedback = `⭐ Partial Match (1 Star - ${percentage}%). Basic table created. Still needed: ${missingItems.slice(0, 2).join(', ')}.`;
    } else {
        feedback = `❌ Needs Revision (${percentage}%). Required structure was incomplete. Missing: ${missingItems.slice(0, 2).join(', ')}.`;
    }

    return {
        percentage,
        stars,
        is_perfect,
        is_passing,
        checks,
        missingItems,
        passedItems,
        feedback
    };
}

/**
 * Evaluates SHOW TABLES results for multi-table DDL cases
 */
function evaluateTables(actualRows, expectedRows) {
    const getNames = (rows) => (rows || []).map(r => norm(Object.values(r)[0])).filter(Boolean);
    const expTables = getNames(expectedRows);
    const actTables = getNames(actualRows);

    if (expTables.length === 0) {
        return { percentage: 100, stars: 3, is_perfect: true, is_passing: true, checks: [], feedback: '✅ Tables verified.' };
    }

    const actSet = new Set(actTables);
    let matched = 0;
    const checks = [];
    const missing = [];

    for (const tbl of expTables) {
        if (actSet.has(tbl)) {
            matched++;
            checks.push({ title: `Table '${tbl}'`, passed: true, detail: `Created.` });
        } else {
            checks.push({ title: `Table '${tbl}'`, passed: false, detail: `Missing.` });
            missing.push(tbl);
        }
    }

    const percentage = Math.round((matched / expTables.length) * 100);
    const stars = percentage === 100 ? 3 : percentage >= 60 ? 2 : percentage >= 20 ? 1 : 0;

    let feedback = '';
    if (stars === 3) feedback = `🌟 Perfect! All ${expTables.length} tables created.`;
    else if (stars === 2) feedback = `⭐ Good Progress (${matched}/${expTables.length} tables). Missing: ${missing.join(', ')}.`;
    else if (stars === 1) feedback = `⭐ Initial Tables Created (${matched}/${expTables.length}). Missing: ${missing.join(', ')}.`;
    else feedback = `❌ Incomplete. No expected tables were found.`;

    return {
        percentage,
        stars,
        is_perfect: percentage === 100,
        is_passing: percentage >= 20,
        checks,
        missingItems: missing,
        feedback
    };
}

/**
 * Evaluates DML / DQL table rows comparison
 */
function evaluateRows(actualRows, expectedRows) {
    if (!Array.isArray(expectedRows) || expectedRows.length === 0) {
        return { percentage: 100, stars: 3, is_perfect: true, is_passing: true, checks: [], feedback: '✅ Query validated.' };
    }
    if (!Array.isArray(actualRows) || actualRows.length === 0) {
        return {
            percentage: 0,
            stars: 0,
            is_perfect: false,
            is_passing: false,
            checks: [{ title: 'Query Results', passed: false, detail: 'No rows returned or affected.' }],
            feedback: '❌ No matching data found in table.'
        };
    }

    // Exact stringified row matching count
    const normalizeRow = (r) => Object.fromEntries(
        Object.entries(r).map(([k, v]) => [norm(k), v === null ? null : norm(v)])
    );

    const normExp = expectedRows.map(r => JSON.stringify(normalizeRow(r)));
    const normAct = actualRows.map(r => JSON.stringify(normalizeRow(r)));

    let matchedCount = 0;
    const actSet = new Set(normAct);
    for (const expStr of normExp) {
        if (actSet.has(expStr)) matchedCount++;
    }

    const percentage = Math.round((matchedCount / normExp.length) * 100);
    const stars = percentage === 100 ? 3 : percentage >= 65 ? 2 : percentage >= 30 ? 1 : 0;

    let feedback = '';
    if (stars === 3) feedback = `✅ Perfect! Data and row states match 100%.`;
    else if (stars === 2) feedback = `⭐ Mostly correct (${percentage}% matched). Some values or filters need adjustment.`;
    else if (stars === 1) feedback = `⭐ Partial result (${percentage}% matched). Review the target rows and conditions.`;
    else feedback = `❌ Result mismatch (${percentage}%). Check the expected rows and try again.`;

    return {
        percentage,
        stars,
        is_perfect: percentage === 100,
        is_passing: percentage >= 30,
        checks: [{
            title: 'Rows Accuracy',
            passed: stars === 3,
            detail: `${matchedCount} of ${normExp.length} expected rows matched.`
        }],
        feedback
    };
}

/**
 * Master evaluator dispatcher
 */
function evaluateSqlResult(sqlType, actualRows, expectedRows, expectedResultSql = '') {
    const isMultiTable = norm(expectedResultSql).includes('show tables');
    const isSchemaCheck = norm(expectedResultSql).includes('show columns') || 
                          norm(expectedResultSql).includes('describe ') ||
                          norm(expectedResultSql).includes('information_schema');

    if (sqlType === 'DDL') {
        if (isMultiTable) {
            return evaluateTables(actualRows, expectedRows);
        }
        if (isSchemaCheck || (actualRows && actualRows[0] && (actualRows[0].Field !== undefined || actualRows[0].COLUMN_NAME !== undefined))) {
            return evaluateSchema(actualRows, expectedRows);
        }
        return evaluateTables(actualRows, expectedRows);
    }

    // DML or DQL
    return evaluateRows(actualRows, expectedRows);
}

module.exports = {
    evaluateSchema,
    evaluateTables,
    evaluateRows,
    evaluateSqlResult
};
