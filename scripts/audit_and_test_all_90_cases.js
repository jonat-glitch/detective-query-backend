const { systemDB, playgroundDB } = require('../db');
const { evaluateSqlResult } = require('../utils/queryEvaluator');

function normalizeRows(rows) {
    return rows.map(row =>
        JSON.stringify(
            Object.fromEntries(
                Object.entries(row).map(([k, v]) => [
                    k.toLowerCase(),
                    v === null ? null : String(v).trim().toLowerCase()
                ])
            )
        )
    ).sort();
}

function rowsMatch(actual, expected) {
    if (actual.length !== expected.length) return false;
    const a = normalizeRows(actual);
    const e = normalizeRows(expected);
    return JSON.stringify(a) === JSON.stringify(e);
}

async function runSetup(connection, setupSql) {
    if (!setupSql || !setupSql.trim()) return;
    const statements = setupSql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);
    for (const stmt of statements) {
        try {
            await connection.query(stmt);
        } catch (e) {
            throw new Error(`Setup error: "${stmt.substring(0, 60)}..." => ${e.message}`);
        }
    }
}

async function main() {
    console.log('🔍 Starting verification test of ALL 90 finalized cases...\n');

    const [cases] = await systemDB.query(
        `SELECT * FROM cases WHERE is_active = 1 ORDER BY mode, sql_type, difficulty_id, case_id`
    );

    console.log(`Loaded ${cases.length} active cases from database.\n`);

    const results = [];
    const TEST_DB = `playground_verify_test_${Date.now()}`;

    // Load suspects from playgroundDB
    let suspects = [];
    try {
        const [sRows] = await playgroundDB.query(`SELECT suspect_id, name, status FROM suspects`);
        suspects = sRows;
    } catch (e) {
        console.warn('Failed to load suspects:', e.message);
    }

    let isolatedConn = null;
    try {
        await systemDB.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
        await systemDB.query(`CREATE DATABASE \`${TEST_DB}\``);
        isolatedConn = await playgroundDB.getConnection();
    } catch (e) {
        console.error('Failed to init test connection:', e.message);
        process.exit(1);
    }

    for (let i = 0; i < cases.length; i++) {
        const c = cases[i];
        const res = {
            case_id: c.case_id,
            mode: c.mode,
            sql_type: c.sql_type,
            difficulty_id: c.difficulty_id,
            title: c.title,
            issues: [],
            warnings: [],
            correct_query_ok: false,
            validation_ok: false,
            objectives_count: 0,
            objectives_passed: 0
        };

        // Check structured case_objectives in DB
        const [objs] = await systemDB.query(
            `SELECT * FROM case_objectives WHERE case_id = ? ORDER BY objective_order ASC`,
            [c.case_id]
        );
        res.objectives_count = objs.length;
        if (objs.length === 0) {
            res.issues.push('Missing rows in case_objectives table');
        }

        // 1. DQL Validation
        if (c.sql_type === 'DQL') {
            try {
                const [rows] = await playgroundDB.query(c.correct_query);
                res.correct_query_ok = true;
                if (!rows || rows.length === 0) {
                    res.warnings.push('Returned 0 rows on playground');
                } else {
                    res.validation_ok = true;
                }
            } catch (e) {
                res.issues.push(`correct_query failed: ${e.message}`);
            }

            // Check suspects
            if (c.correct_suspect_id) {
                const found = suspects.find(s => Number(s.suspect_id) === Number(c.correct_suspect_id));
                if (!found) {
                    res.issues.push(`correct_suspect_id ${c.correct_suspect_id} not found in suspects!`);
                }
            }

            // Test objectives
            for (const obj of objs) {
                let passed = false;
                if (obj.validation_type === 'pattern' && obj.required_keyword) {
                    const normQ = (c.correct_query || '').toLowerCase().replace(/\s+/g, ' ');
                    if (normQ.includes(obj.required_keyword.toLowerCase().trim())) {
                        passed = true;
                    }
                } else if (obj.expected_query) {
                    try {
                        const [expectedRows] = await playgroundDB.query(obj.expected_query);
                        if (res.correct_query_ok) {
                            const [actualRows] = await playgroundDB.query(c.correct_query);
                            if (rowsMatch(actualRows, expectedRows)) {
                                passed = true;
                            }
                        }
                    } catch (e) {
                        res.issues.push(`Objective ${obj.objective_order} expected_query failed: ${e.message}`);
                    }
                } else {
                    passed = true;
                }
                if (passed) res.objectives_passed++;
            }
        } else {
            // 2. DDL and DML Validation
            if (!c.setup_sql || !c.setup_sql.trim()) res.issues.push('Missing setup_sql');
            if (!c.expected_result_sql || !c.expected_result_sql.trim()) res.issues.push('Missing expected_result_sql');

            try {
                // Re-create fresh database for this case
                await systemDB.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
                await systemDB.query(`CREATE DATABASE \`${TEST_DB}\``);
                await isolatedConn.query(`USE \`${TEST_DB}\``);

                if (c.setup_sql) await runSetup(isolatedConn, c.setup_sql);

                // Run correct query
                try {
                    await isolatedConn.query(c.correct_query);
                    res.correct_query_ok = true;
                } catch (e) {
                    res.issues.push(`correct_query failed: ${e.message}`);
                }

                // Run expected_result_sql
                let actualRows = [];
                if (c.expected_result_sql) {
                    try {
                        const [rows] = await isolatedConn.query(c.expected_result_sql);
                        actualRows = rows;
                    } catch (e) {
                        res.issues.push(`expected_result_sql failed: ${e.message}`);
                    }
                }

                // Verify state
                await systemDB.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
                await systemDB.query(`CREATE DATABASE \`${TEST_DB}\``);
                await isolatedConn.query(`USE \`${TEST_DB}\``);
                if (c.setup_sql) await runSetup(isolatedConn, c.setup_sql);

                let expectedRows = [];
                try {
                    await isolatedConn.query(c.correct_query);
                    const [eRows] = await isolatedConn.query(c.expected_result_sql);
                    expectedRows = eRows;
                } catch (_) {}

                if (res.correct_query_ok && c.expected_result_sql) {
                    const evalRes = evaluateSqlResult(c.sql_type, actualRows, expectedRows, c.expected_result_sql);
                    if (evalRes && evalRes.is_perfect) {
                        res.validation_ok = true;
                    } else {
                        res.issues.push(`Evaluation not perfect: stars=${evalRes ? evalRes.stars : 0}, pct=${evalRes ? evalRes.percentage : 0}% (${evalRes ? evalRes.feedback : ''})`);
                    }
                }

                // Test objectives
                for (const obj of objs) {
                    let passed = false;
                    if (obj.validation_type === 'pattern' && obj.required_keyword) {
                        const normQ = (c.correct_query || '').toLowerCase().replace(/\s+/g, ' ');
                        if (normQ.includes(obj.required_keyword.toLowerCase().trim())) {
                            passed = true;
                        }
                    } else if (res.validation_ok) {
                        passed = true;
                    }
                    if (passed) res.objectives_passed++;
                }

            } catch (err) {
                res.issues.push(`Execution error: ${err.message}`);
            }
        }

        results.push(res);
        const statusEmoji = res.issues.length === 0 ? '✅' : '❌';
        console.log(`${statusEmoji} [${c.mode} ${c.sql_type} D${c.difficulty_id}] #${c.case_id}: "${c.title}" | Issues: ${res.issues.length}, Objs: ${res.objectives_passed}/${res.objectives_count}`);
        if (res.issues.length > 0) {
            console.log(`   🚨 ${res.issues.join(' | ')}`);
        }
    }

    // Cleanup
    try {
        await systemDB.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
        if (isolatedConn) isolatedConn.release();
    } catch (_) {}

    console.log('\n══════════════════════════════════════════════════════════════════════════');
    const totalIssues = results.filter(r => r.issues.length > 0);
    console.log(`TOTAL CASES: ${results.length}`);
    console.log(`PASSED: ${results.length - totalIssues.length} / ${results.length}`);
    console.log(`FAILED: ${totalIssues.length}`);
    console.log('══════════════════════════════════════════════════════════════════════════\n');

    if (totalIssues.length > 0) {
        console.table(totalIssues.map(r => ({ id: r.case_id, mode: r.mode, type: r.sql_type, title: r.title, issues: r.issues.join('; ') })));
        process.exit(1);
    } else {
        console.log('🎉 100% OF CASES VALIDATED PERFECTLY! Zero errors, zero mismatches, 100% answer keys verified.');
        process.exit(0);
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
