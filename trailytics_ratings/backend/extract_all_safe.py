import sys
import re

def extract_routes(file_path, route_signatures, route_names):
    with open(file_path, 'r') as f:
        content = f.read()
    
    pattern = re.compile(r"^app\.(?:get|post|put|delete|patch|use)\(", re.MULTILINE)
    matches = list(pattern.finditer(content))
    
    extracted = {}
    for sig in route_signatures:
        start_idx = content.find(sig)
        if start_idx == -1:
            print(f"Warning: Route {sig} not found.")
            continue
            
        end_idx = len(content)
        for match in matches:
            if match.start() > start_idx:
                end_idx = match.start()
                break
                
        block = content[start_idx:end_idx].strip()
        # Replace the route definition start
        func_name = route_names.get(sig, "unknown")
        lines = block.split('\n')
        lines[0] = f"export const {func_name} = async (req, res) => {{"
        block = '\n'.join(lines)
        
        # Replace the top-level `});` with `};`
        block = re.sub(r'^}\);', '};', block, flags=re.MULTILINE)
        
        extracted[sig] = block

    return extracted

def run_extraction(target_file, sigs, names):
    results = extract_routes('clean_api.cjs', sigs, names)
    with open(target_file, 'w') as out:
        out.write("import pool from '../../config/db.js';\n\n")
        for sig, block in results.items():
            out.write(block + '\n\n')
            print(f"Extracted {names.get(sig)}")

if __name__ == "__main__":
    
    comp_sigs = [
        "app.get('/api/ratings/competitor-mentions'",
        "app.get('/api/ratings/competitor-matrix'",
        "app.get('/api/ratings/competitor-mappings'",
        "app.post('/api/ratings/competitor-mappings'",
        "app.put('/api/ratings/competitor-mappings/:id'",
        "app.delete('/api/ratings/competitor-mappings/:id'",
        "app.get('/api/ratings/competitor-mapping-types'",
        "app.get('/api/ratings/competitor-mapping-options'",
        "app.get('/api/ratings/competitor-mapping-pairs'",
        "app.post('/api/ratings/competitor-mapping-pairs'",
        "app.put('/api/ratings/competitor-mapping-pairs/:id'",
        "app.delete('/api/ratings/competitor-mapping-pairs/:id'",
        "app.get('/api/ratings/competitor-mapping-pairs/export'",
        "app.get('/api/ratings/competitor-brands'"
    ]
    comp_names = {
        "app.get('/api/ratings/competitor-mentions'": "getCompetitorMentions",
        "app.get('/api/ratings/competitor-matrix'": "getCompetitorMatrix",
        "app.get('/api/ratings/competitor-mappings'": "getCompetitorMappings",
        "app.post('/api/ratings/competitor-mappings'": "createCompetitorMapping",
        "app.put('/api/ratings/competitor-mappings/:id'": "updateCompetitorMapping",
        "app.delete('/api/ratings/competitor-mappings/:id'": "deleteCompetitorMapping",
        "app.get('/api/ratings/competitor-mapping-types'": "getCompetitorMappingTypes",
        "app.get('/api/ratings/competitor-mapping-options'": "getCompetitorMappingOptions",
        "app.get('/api/ratings/competitor-mapping-pairs'": "getCompetitorMappingPairs",
        "app.post('/api/ratings/competitor-mapping-pairs'": "createCompetitorMappingPair",
        "app.put('/api/ratings/competitor-mapping-pairs/:id'": "updateCompetitorMappingPair",
        "app.delete('/api/ratings/competitor-mapping-pairs/:id'": "deleteCompetitorMappingPair",
        "app.get('/api/ratings/competitor-mapping-pairs/export'": "exportCompetitorMappingPairs",
        "app.get('/api/ratings/competitor-brands'": "getCompetitorBrands"
    }
    
    issues_sigs = [
        "app.get('/api/ratings/issues-breakdown'",
        "app.get('/api/ratings/issue-detail'",
        "app.get('/api/ratings/reviews-by-issue'",
        "app.get('/api/ratings/asin-issues'",
        "app.get('/api/ratings/issue/:name/drilldown'",
        "app.get('/api/ratings/issue-statuses'",
        "app.post('/api/ratings/issue-statuses'"
    ]
    issues_names = {
        "app.get('/api/ratings/issues-breakdown'": "getIssuesBreakdown",
        "app.get('/api/ratings/issue-detail'": "getIssueDetail",
        "app.get('/api/ratings/reviews-by-issue'": "getReviewsByIssue",
        "app.get('/api/ratings/asin-issues'": "getAsinIssues",
        "app.get('/api/ratings/issue/:name/drilldown'": "getIssueDrilldown",
        "app.get('/api/ratings/issue-statuses'": "getIssueStatuses",
        "app.post('/api/ratings/issue-statuses'": "createIssueStatus"
    }

    reviews_sigs = [
        "app.get('/api/ratings/reviews'",
        "app.get('/api/ratings/reviews/search'",
        "app.get('/api/ratings/product-categories'",
        "app.get('/api/ratings/products'",
        "app.post('/api/ratings/classify-review'"
    ]
    reviews_names = {
        "app.get('/api/ratings/reviews'": "getReviews",
        "app.get('/api/ratings/reviews/search'": "searchReviews",
        "app.get('/api/ratings/product-categories'": "getProductCategories",
        "app.get('/api/ratings/products'": "getProducts",
        "app.post('/api/ratings/classify-review'": "classifyReview"
    }
    
    audit_sigs = [
        "app.post('/api/ml-audit/product-inspect'",
        "app.get('/api/ml-audit/pending'",
        "app.post('/api/ml-audit/approve'",
        "app.post('/api/ml-audit/reject'",
        "app.post('/api/ml-audit/bulk-trigger'"
    ]
    audit_names = {
        "app.post('/api/ml-audit/product-inspect'": "inspectProduct",
        "app.get('/api/ml-audit/pending'": "getPendingAudit",
        "app.post('/api/ml-audit/approve'": "approveAudit",
        "app.post('/api/ml-audit/reject'": "rejectAudit",
        "app.post('/api/ml-audit/bulk-trigger'": "bulkTriggerAudit"
    }
    
    run_extraction('src/controllers/competition/competition.controller.js', comp_sigs, comp_names)
    run_extraction('src/controllers/issues/issues.controller.js', issues_sigs, issues_names)
    run_extraction('src/controllers/reviews/reviews.controller.js', reviews_sigs, reviews_names)
    run_extraction('src/controllers/ml/audit.controller.js', audit_sigs, audit_names)
