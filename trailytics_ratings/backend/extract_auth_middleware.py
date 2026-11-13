import sys
import re

def extract_middleware():
    with open('clean_api.cjs', 'r') as f:
        content = f.read()
    
    # We want to extract authenticateApi and its dependencies:
    # _loadSessionMembership
    # sessionCache etc
    
    start1 = content.find('async function _loadSessionMembership')
    if start1 == -1: return
    
    end1 = content.find('// ─── Tiny in-memory response cache ──────────────────────────────────────────')
    if end1 == -1: return
    
    # Actually, we can just extract from _loadSessionMembership all the way to app.use(authenticateApi)
    start_all = content.find('async function _loadSessionMembership')
    end_all = content.find('app.use(authenticateApi);')
    
    block = content[start_all:end_all].strip()
    
    with open('src/middleware/auth.middleware.js', 'w') as out:
        out.write("import pool from '../config/db.js';\n")
        out.write("import crypto from 'crypto';\n\n")
        out.write(block)
        out.write("\n\nexport { authenticateApi };\n")

if __name__ == "__main__":
    extract_middleware()
