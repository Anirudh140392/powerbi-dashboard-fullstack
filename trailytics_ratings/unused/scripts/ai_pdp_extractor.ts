import { chromium } from 'playwright';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const pool = new pg.Pool({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
    ssl: { rejectUnauthorized: false }
});

// Configure Gemini (Requires GEMINI_API_KEY in .env)
const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

// The schema we expect Gemini to return
const SpecExtractionSchema = {
    type: Type.OBJECT,
    properties: {
        category: {
            type: Type.STRING,
            description: "The product category (e.g. 'Pressure Cooker', 'Mixer Grinder')"
        },
        material: {
            type: Type.STRING,
            description: "The specific material if applicable (e.g. 'Aluminium', 'Stainless Steel', 'Triply'). Leave empty if Electric appliance.",
            nullable: true
        },
        wattage: {
            type: Type.STRING,
            description: "The wattage if an Electric appliance (e.g. '500W', '750W'). Leave empty if not applicable.",
            nullable: true
        },
        capacity: {
            type: Type.STRING,
            description: "The capacity of the product if applicable (e.g. '3L', '5L').",
            nullable: true
        },
        sentiment_summary: {
            type: Type.STRING,
            description: "General summary of any reviews present on the page.",
            nullable: true
        }
    },
    required: ["category"]
};

// Playwright scraper function
async function scrapeProductPage(url: string): Promise<string | null> {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
        console.log(`[Scraper] Navigating to ${url}...`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        // Extract basic body text (you can enhance this with Cheerio or targeted selectors for Amazon/Flipkart)
        // We strip aggressive white-spaces to save tokens
        const rawText = await page.evaluate(() => document.body.innerText);
        return rawText.replace(/\s+/g, ' ').slice(0, 30000); // Send max 30K chars safely
    } catch (e) {
        console.error(`[Scraper] Error loading ${url}:`, e);
        return null;
    } finally {
        await browser.close();
    }
}

// AI Analysis Function
async function analyzeProductContent(text: string) {
    if (!ai) throw new Error("GEMINI_API_KEY is not set in .env.");

    console.log(`[Gemini] Analyzing ${text.length} characters of product text...`);
    const prompt = `
    You are an expert E-commerce product cataloger. Read the following Product Description Page text and extract the Product specifications.
    We need to determine the primary Category, the Material (if it's cookware like Pressure Cookers or Gas Stoves), the Wattage (if it's an electric appliance like Mixer Grinder), and the Capacity.
    
    Product Text:
    ${text}
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: SpecExtractionSchema,
                temperature: 0.1,
            }
        });

        const jsonString = response.text || "{}";
        return JSON.parse(jsonString);
    } catch (e) {
        console.error("[Gemini] Analysis failed:", e);
        return null;
    }
}

// Main Runner
export async function runAIExtractionJob(urls: string[]) {
    console.log("🚀 Starting AI Extraction Job...");

    for (const url of urls) {
        try {
            const rawContent = await scrapeProductPage(url);
            if (!rawContent) continue;

            if (!ai) {
                console.log("[AI] Missing API key, skipping Gemini extraction...");
                console.log("[Scraper Output Extract]:\n", rawContent.slice(0, 300) + "...\n");
                continue;
            }

            const analysis = await analyzeProductContent(rawContent);
            console.log(`\n🎯 AI Classification Result for ${url}:`);
            console.log(JSON.stringify(analysis, null, 2));

            // Here you would connect to PostgreSQL and apply the logic:
            // await client.query(`UPDATE ratings.products SET category=$1, ... WHERE url=$2`, [analysis.category, url]);
            
        } catch (error) {
            console.error(`Error processing ${url}:`, error);
        }
    }
    
    console.log("✅ AI Extraction Job Complete.");
}

// Allow Direct Execution
if (process.argv[1] && process.argv[1].endsWith('ai_pdp_extractor.ts')) {
    const sampleUrls = [
        // Example: https://www.amazon.in/dp/B08V8R5MZC
        "https://prestigexclusive.in/kitchen-appliances/mixer-grinder/endura-plus-1000w-mixer-grinder-with-6-jars" // You can provide your DB urls here
    ];
    
    // Check if the user passed a URL via CLI argument
    if (process.argv[2]) {
        runAIExtractionJob([process.argv[2]]).finally(() => process.exit(0));
    } else {
        runAIExtractionJob(sampleUrls).finally(() => process.exit(0));
    }
}
