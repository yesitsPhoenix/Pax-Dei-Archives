// supabaseClient.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.85.0/+esm';

const SUPABASE_URL = 'https://jrjgbnopmfovxwvtbivh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impyamdibm9wbWZvdnh3dnRiaXZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDgxOTg1MjYsImV4cCI6MjAyMzc3NDUyNn0.za7oUzFhNmBdtcCRBmxwW5FSTFRWVAY6_rsRwlr3iqY';

const rawSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let dbCallCount = 0;
const dbCallLog = [];

const loggedSupabase = new Proxy(rawSupabase, {
    get(target, prop) {
        if (prop === 'from') {
            return (tableName) => {
                dbCallCount++;
                const callId = dbCallCount;
                const timestamp = new Date().toISOString();
                
                const builder = target.from(tableName);
                
                return wrapQueryBuilder(builder, tableName, callId, timestamp);
            };
        }
        
        if (prop === 'auth') {
            return new Proxy(target.auth, {
                get(authTarget, authProp) {
                    if (typeof authTarget[authProp] === 'function') {
                        return (...args) => {
                            dbCallCount++;
                            return authTarget[authProp](...args);
                        };
                    }
                    return authTarget[authProp];
                }
            });
        }
        
        return target[prop];
    }
});

function wrapQueryBuilder(builder, tableName, callId, timestamp) {
    const operations = [];
    
    return new Proxy(builder, {
        get(target, prop) {
            if (['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'in', 'order', 'limit', 'single', 'maybeSingle'].includes(prop)) {
                return (...args) => {
                    operations.push({ method: prop, args });
                    const result = target[prop](...args);
                    
                    if (['single', 'maybeSingle'].includes(prop) || (result && result.then)) {
                        const queryStr = operations.map(op => {
                            if (op.args.length > 0) {
                                return `${op.method}(${JSON.stringify(op.args).slice(1, -1)})`;
                            }
                            return op.method;
                        }).join('.');
                        
                        dbCallLog.push({
                            id: callId,
                            timestamp,
                            table: tableName,
                            operations: [...operations],
                            query: queryStr
                        });
                    }
                    
                    return wrapQueryBuilder(result, tableName, callId, timestamp);
                };
            }
            
            return target[prop];
        }
    });
}

export const supabase = loggedSupabase;

export function getDbCallCount() {
    return dbCallCount;
}

export function getDbCallLog() {
    return [...dbCallLog];
}

export function resetDbCallCount() {
    dbCallCount = 0;
    dbCallLog.length = 0;
}

export function printDbCallSummary() {
    console.log('%c=== Supabase Call Summary ===', 'color: #f59e0b; font-weight: bold; font-size: 14px');
    console.log(`Total calls: ${dbCallCount}`);
    
    const tableStats = {};
    dbCallLog.forEach(log => {
        if (!tableStats[log.table]) {
            tableStats[log.table] = 0;
        }
        tableStats[log.table]++;
    });
    
    console.log('Calls by table:');
    Object.entries(tableStats).sort((a, b) => b[1] - a[1]).forEach(([table, count]) => {
        console.log(`  ${table}: ${count}`);
    });
    
    console.log('\nDetailed log:');
    console.table(dbCallLog.map(log => ({
        ID: log.id,
        Table: log.table,
        Query: log.query,
        Time: log.timestamp.split('T')[1]
    })));
}

if (typeof window !== 'undefined') {
    window.supabaseStats = {
        getCount: getDbCallCount,
        getLog: getDbCallLog,
        reset: resetDbCallCount,
        summary: printDbCallSummary
    };
}
