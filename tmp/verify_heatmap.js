
import performanceMarketingService from '../backend/src/services/performanceMarketingService.js';
import 'dotenv/config';

// Mock filter context or provide actual values
const filters = {
  platform: 'All',
  brand: 'All',
  startDate: '2025-10-01',
  endDate: '2025-12-31',
};

async function verifyHeatmapService() {
  try {
    console.log("🚀 Testing performanceMarketingService.getFormatPerformance...");
    
    // Set environment variables if not loaded
    process.env.CLICKHOUSE_URL = 'http://13.200.55.131:8123';
    process.env.CLICKHOUSE_USER = 'readonly_user';
    process.env.CLICKHOUSE_PASSWORD = 'Readonly@123';
    process.env.CLICKHOUSE_DB = 'mars';

    const data = await performanceMarketingService.getFormatPerformance(filters);
    console.log("✅ Data length:", data.length);
    
    if (data.length > 0) {
      console.log("✅ Sample Row:", JSON.stringify(data[0], null, 2));
      const hasKeywordType = 'KeywordType' in data[0];
      const hasKeyword = 'Keyword' in data[0];
      const hasCity = 'City' in data[0];
      const hasDate = 'date' in data[0];
      
      console.log("✅ Has KeywordType:", hasKeywordType);
      console.log("✅ Has Keyword:", hasKeyword);
      console.log("✅ Has City:", hasCity);
      console.log("✅ Has date:", hasDate);
    } else {
      console.log("⚠️ No data returned. This might be expected if no entries match the date range in tb_pm_keyword_rca.");
    }
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

verifyHeatmapService();
