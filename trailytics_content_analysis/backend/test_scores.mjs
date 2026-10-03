import { createClient } from '@clickhouse/client';

const client = createClient({
  url: 'http://localhost:8123',
});

async function run() {
  const query = `
    SELECT platform,
           max(title_score) as max_title,
           max(bullet_score) as max_bullet,
           max(description_score) as max_desc,
           max(thumbnail_image_score) as max_img,
           max(thumbnail_video_score) as max_vid,
           max(aplus_image_score) as max_aplus,
           max(total_score) as max_total
    FROM default.rb_content_olap
    GROUP BY platform
  `;
  const result = await client.query({ query, format: 'JSONEachRow' });
  const data = await result.json();
  console.log(JSON.stringify(data, null, 2));
}

run().catch(console.error);
