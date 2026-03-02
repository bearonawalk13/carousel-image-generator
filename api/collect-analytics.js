/**
 * Phase 5: Analytics Collector + AI Diagnosis + Weekly Report
 *
 * Vercel Cron Job — runs daily at 07:00 UTC
 *
 * Flow:
 * 1. Query published assets needing 48h or 7d metrics collection
 * 2. Call Upload Post Analytics API for each
 * 3. Write metrics to Airtable Assets
 * 4. Run AI bottleneck diagnosis (OpenRouter/Claude) for 7d snapshots
 * 5. Update Brand Codex with profile metrics
 * 6. On Mondays: rotate snapshots + send weekly Telegram report
 */

// ============================================================
// CONFIG
// ============================================================
const UPLOAD_POST_BASE = 'https://api.upload-post.com';
const AIRTABLE_BASE_URL = 'https://api.airtable.com/v0';
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const TELEGRAM_BASE = 'https://api.telegram.org';

const ASSETS_TABLE = 'tblJAnftAWUNLpzBf';
const CODEX_TABLE = 'tbl7653Ra6hQZ5uNG';

// ============================================================
// HELPERS
// ============================================================

function getEnv(key) {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function hoursAgo(dateStr) {
  if (!dateStr) return Infinity;
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60);
}

function dayOfWeek() {
  return new Date().getUTCDay(); // 0=Sun, 1=Mon
}

function pctChange(current, previous) {
  if (!previous || previous === 0) return current > 0 ? '+100%' : '0%';
  const pct = ((current - previous) / previous * 100).toFixed(0);
  return pct >= 0 ? `+${pct}%` : `${pct}%`;
}

// ============================================================
// AIRTABLE API
// ============================================================

async function airtableQuery(tableId, params = {}) {
  const baseId = getEnv('AIRTABLE_BASE_ID');
  const token = getEnv('AIRTABLE_TOKEN');

  const url = new URL(`${AIRTABLE_BASE_URL}/${baseId}/${tableId}`);
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) {
      v.forEach(val => url.searchParams.append(k, val));
    } else {
      url.searchParams.set(k, v);
    }
  }

  const records = [];
  let offset = null;

  do {
    if (offset) url.searchParams.set('offset', offset);
    const resp = await fetch(url.toString(), {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Airtable query failed: ${resp.status} ${text.substring(0, 200)}`);
    }
    const data = await resp.json();
    records.push(...(data.records || []));
    offset = data.offset;
  } while (offset);

  return records;
}

async function airtablePatch(tableId, recordId, fields) {
  const baseId = getEnv('AIRTABLE_BASE_ID');
  const token = getEnv('AIRTABLE_TOKEN');

  const resp = await fetch(`${AIRTABLE_BASE_URL}/${baseId}/${tableId}/${recordId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields })
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Airtable patch ${recordId} failed: ${resp.status} ${text.substring(0, 200)}`);
  }
  return resp.json();
}

// ============================================================
// UPLOAD POST ANALYTICS API
// ============================================================

async function getPostAnalytics(requestId) {
  const apiKey = getEnv('UPLOAD_POST_API_KEY');

  const resp = await fetch(`${UPLOAD_POST_BASE}/api/analytics/post-analytics`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ request_id: requestId })
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.error(`Post analytics failed for ${requestId}: ${resp.status} ${text.substring(0, 200)}`);
    return null;
  }

  return resp.json();
}

async function getProfileAnalytics() {
  const apiKey = getEnv('UPLOAD_POST_API_KEY');

  const resp = await fetch(`${UPLOAD_POST_BASE}/api/analytics/analytics`, {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });

  if (!resp.ok) {
    console.error(`Profile analytics failed: ${resp.status}`);
    return null;
  }

  return resp.json();
}

async function getTotalImpressions() {
  const apiKey = getEnv('UPLOAD_POST_API_KEY');

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const resp = await fetch(`${UPLOAD_POST_BASE}/api/analytics/total-impressions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      start_date: weekAgo.toISOString().split('T')[0],
      end_date: now.toISOString().split('T')[0]
    })
  });

  if (!resp.ok) {
    console.error(`Total impressions failed: ${resp.status}`);
    return null;
  }

  return resp.json();
}

// ============================================================
// EXTRACT METRICS FROM UPLOAD POST RESPONSE
// ============================================================

function extractMetrics(analyticsData) {
  if (!analyticsData) return null;

  // Upload Post returns metrics per platform in results
  // Aggregate across all platforms for this asset
  let reach = 0, views = 0, likes = 0, comments = 0, saves = 0, shares = 0;

  // Handle different response formats
  const data = analyticsData.data || analyticsData.analytics || analyticsData;

  if (data.results) {
    // Per-platform results
    for (const [platform, metrics] of Object.entries(data.results)) {
      reach += metrics.reach || metrics.impressions || 0;
      views += metrics.views || metrics.plays || metrics.video_views || 0;
      likes += metrics.likes || metrics.reactions || 0;
      comments += metrics.comments || metrics.replies || 0;
      saves += metrics.saves || metrics.bookmarks || 0;
      shares += metrics.shares || metrics.reposts || metrics.retweets || 0;
    }
  } else {
    // Flat response
    reach = data.reach || data.impressions || 0;
    views = data.views || data.plays || data.video_views || 0;
    likes = data.likes || data.reactions || 0;
    comments = data.comments || data.replies || 0;
    saves = data.saves || data.bookmarks || 0;
    shares = data.shares || data.reposts || 0;
  }

  return { reach, views, likes, comments, saves, shares };
}

// ============================================================
// AI BOTTLENECK DIAGNOSIS
// ============================================================

const DIAGNOSIS_SYSTEM_PROMPT = `You are a social media performance analyst for a personal brand content system. Your job is to diagnose WHY a piece of content performed the way it did, and provide specific, actionable fix suggestions that reference the actual content.

You will receive:
1. Full content context (hook, body, CTA, pillar, format, lane, messaging framework)
2. Performance data at 48h and 7d after publishing
3. Baseline averages for this platform and format

Your diagnosis must be CONTENT-SPECIFIC. Never give generic advice like "improve your hook" — instead reference the specific hook text and explain what's wrong with it and how to fix it.

## Bottleneck Categories

- **Hook**: The content was seen (decent reach) but people didn't engage (low views-to-reach ratio). The opening line or thumbnail failed to pull people in.
- **Retention**: People started consuming but didn't stay (views ok but saves/shares/comments low relative to views). The body content didn't deliver enough value to earn engagement.
- **Distribution**: The content quality signals are good (engagement ratios strong) but absolute reach is low. The algorithm didn't push it — could be posting time, format mismatch, or inconsistent publishing cadence.
- **Winner**: All metrics above baseline averages. Flag what worked well and why.
- **Unclear**: Mixed signals or not enough data to diagnose confidently.

## Scoring (0-100)

- **Reach Score**: How well did this content get distributed? Compare reach to baseline.
- **Depth Score**: How deeply did the audience engage? Weight saves and shares highest, then comments, then likes.
- **Overall Score**: Lane-weighted composite:
  - Sidewalk lane: 40% Reach + 40% Depth + 20% base engagement
  - Slow Lane: 30% Reach + 50% Depth + 20% base engagement
  - Fast Lane: 30% Reach + 30% Depth + 40% base engagement (placeholder until conversion data available)

## Output Format

Return ONLY valid JSON with this exact structure:
{
  "overall_score": <0-100>,
  "reach_score": <0-100>,
  "depth_score": <0-100>,
  "bottleneck": "<Hook|Retention|Distribution|Winner|Unclear>",
  "confidence": "<High|Medium|Low>",
  "reasons": ["<reason 1 — specific to THIS content>", "<reason 2>", "<reason 3>"],
  "fixes": ["<fix 1 — specific, actionable, references actual content>", "<fix 2>", "<fix 3>"],
  "sequel_candidate": <true|false>,
  "remix_candidate": <true|false>
}

## Critical Rules

1. ALWAYS reference the actual hook text, body content, or CTA when explaining reasons and fixes
2. Compare to baseline averages — "40% below your average" is more useful than "low reach"
3. Consider the platform + format combination — what works on Instagram Reels differs from LinkedIn Posts
4. If a post is a Winner, explain what specifically made it work so the pattern can be repeated
5. Sequel candidate = same topic deserves a follow-up from a different angle
6. Remix candidate = same content could work better in a different format (e.g., Reel → Carousel)
7. Keep each reason and fix to 1-2 sentences max`;

async function runAIDiagnosis(asset, metrics48h, metrics7d, baselines) {
  const apiKey = getEnv('OPENROUTER_API_KEY');

  const m48 = metrics48h || { reach: 0, views: 0, likes: 0, comments: 0, saves: 0, shares: 0 };
  const m7d = metrics7d || { reach: 0, views: 0, likes: 0, comments: 0, saves: 0, shares: 0 };

  const growth = {};
  for (const key of ['reach', 'views', 'likes', 'comments', 'saves', 'shares']) {
    if (m48[key] > 0) {
      growth[key] = `${(((m7d[key] - m48[key]) / m48[key]) * 100).toFixed(0)}%`;
    } else {
      growth[key] = m7d[key] > 0 ? '+100%' : '0%';
    }
  }

  const userPrompt = `## Content Context
- **Title:** ${asset.Title || 'N/A'}
- **Asset Code:** ${asset['Asset Code'] || 'N/A'}
- **Platform:** ${asset.Platform || 'N/A'}
- **Content Format:** ${asset['Content Format'] || 'N/A'}
- **Content Pillar:** ${asset['Content Pillar'] || 'N/A'}
- **SSF Lane:** ${asset['SSF Lane'] || 'N/A'}
- **CTA:** ${asset['CTA Final'] || 'None'}
- **Messaging Framework:** ${asset['Message Framework'] || 'N/A'}
- **Hook / Opening Line:** ${asset['Opening Line'] || 'N/A'}
- **Body (first 1000 chars):** ${(asset.Body || '').substring(0, 1000) || 'N/A'}
- **Closing Prompt:** ${asset['Closing Prompt'] || 'N/A'}
- **Published At:** ${asset['Published At'] || 'N/A'}

## Performance Data

### 48h Snapshot
- Reach: ${m48.reach}
- Views: ${m48.views}
- Likes: ${m48.likes}
- Comments: ${m48.comments}
- Saves: ${m48.saves}
- Shares: ${m48.shares}

### 7d Snapshot
- Reach: ${m7d.reach}
- Views: ${m7d.views}
- Likes: ${m7d.likes}
- Comments: ${m7d.comments}
- Saves: ${m7d.saves}
- Shares: ${m7d.shares}

### 48h → 7d Growth
- Reach: ${growth.reach}
- Views: ${growth.views}
- Likes: ${growth.likes}
- Comments: ${growth.comments}
- Saves: ${growth.saves}
- Shares: ${growth.shares}

## Baselines (your running averages for ${asset.Platform || 'all'} / ${asset['Content Format'] || 'all'})
- Avg Reach: ${baselines.avgReach || 'N/A'}
- Avg Views: ${baselines.avgViews || 'N/A'}
- Avg Likes: ${baselines.avgLikes || 'N/A'}
- Avg Comments: ${baselines.avgComments || 'N/A'}
- Avg Saves: ${baselines.avgSaves || 'N/A'}
- Avg Shares: ${baselines.avgShares || 'N/A'}

Diagnose this post. Return ONLY the JSON object.`;

  try {
    const resp = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4-20250514',
        messages: [
          { role: 'system', content: DIAGNOSIS_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 1000
      })
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error(`OpenRouter failed: ${resp.status} ${text.substring(0, 200)}`);
      return null;
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Parse JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('AI response not valid JSON:', content.substring(0, 200));
      return null;
    }

    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error('AI diagnosis error:', err.message);
    return null;
  }
}

// ============================================================
// WEEKLY AI PATTERN ANALYSIS
// ============================================================

const WEEKLY_SYSTEM_PROMPT = `You are a social media strategist analyzing a week's worth of content performance data. Your job is to identify PATTERNS across multiple posts — what's working, what isn't, and what to try next.

Look for correlations between:
- Content pillars and engagement levels
- Content formats and reach
- Hook styles and view rates
- CTAs and conversion signals
- Posting days/times and performance
- SSF lanes and audience response

Be specific and actionable. Reference actual post titles and metrics. Keep your analysis to 3-4 concise insights.

Return your analysis as a plain text string (not JSON) — 3-4 bullet points, each 1-2 sentences.`;

async function runWeeklyAnalysis(weekAssets) {
  const apiKey = getEnv('OPENROUTER_API_KEY');

  const summary = weekAssets.map(a => {
    const f = a.fields;
    return `- ${f['Asset Code'] || '?'}: "${f.Title || '?'}" (${f.Platform || '?'} / ${f['Content Format'] || '?'} / ${f['Content Pillar'] || '?'}) — Score: ${f['Overall Score'] || '?'}, Bottleneck: ${f.Bottleneck || '?'}, Reach(7d): ${f['Reach (7d)'] || '?'}, Views(7d): ${f['Views (7d)'] || '?'}, Saves(7d): ${f['Saves (7d)'] || '?'}`;
  }).join('\n');

  try {
    const resp = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4-20250514',
        messages: [
          { role: 'system', content: WEEKLY_SYSTEM_PROMPT },
          { role: 'user', content: `Here are this week's diagnosed posts:\n\n${summary}\n\nWhat patterns do you see? What should we do differently next week?` }
        ],
        temperature: 0.4,
        max_tokens: 500
      })
    });

    if (!resp.ok) return 'Weekly analysis unavailable.';

    const data = await resp.json();
    return data.choices?.[0]?.message?.content || 'No insights generated.';
  } catch (err) {
    return 'Weekly analysis error: ' + err.message;
  }
}

// ============================================================
// TELEGRAM
// ============================================================

async function sendTelegram(message) {
  const token = getEnv('TELEGRAM_BOT_TOKEN');
  const chatId = getEnv('TELEGRAM_CHAT_ID');

  const resp = await fetch(`${TELEGRAM_BASE}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: '' // Disable markdown parsing (URLs with underscores break it)
    })
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.error(`Telegram failed: ${resp.status} ${text.substring(0, 200)}`);
  }
}

// ============================================================
// COMPUTE BASELINES
// ============================================================

function computeBaselines(assets, platform, format) {
  // Filter to assets with 7d metrics matching platform/format
  const matching = assets.filter(a => {
    const f = a.fields;
    return f['Reach (7d)'] &&
      (!platform || f.Platform === platform) &&
      (!format || f['Content Format'] === format);
  });

  if (matching.length === 0) {
    // Fallback: all assets with 7d metrics
    const all = assets.filter(a => a.fields['Reach (7d)']);
    if (all.length === 0) return { avgReach: 'N/A', avgViews: 'N/A', avgLikes: 'N/A', avgComments: 'N/A', avgSaves: 'N/A', avgShares: 'N/A' };
    return calcAverages(all);
  }

  return calcAverages(matching);
}

function calcAverages(records) {
  const n = records.length;
  const sum = (field) => records.reduce((acc, r) => acc + (r.fields[field] || 0), 0);
  return {
    avgReach: Math.round(sum('Reach (7d)') / n),
    avgViews: Math.round(sum('Views (7d)') / n),
    avgLikes: Math.round(sum('Likes (7d)') / n),
    avgComments: Math.round(sum('Comments (7d)') / n),
    avgSaves: Math.round(sum('Saves (7d)') / n),
    avgShares: Math.round(sum('Shares (7d)') / n),
  };
}

// ============================================================
// MAIN HANDLER
// ============================================================

module.exports = async (req, res) => {
  const startTime = Date.now();
  const log = [];
  const errors = [];

  try {
    // --------------------------------------------------------
    // 1. Query published assets
    // --------------------------------------------------------
    const allAssets = await airtableQuery(ASSETS_TABLE, {
      filterByFormula: `AND({Asset Status}="Published", {Upload Post Request ID}!="")`,
      'fields[]': [
        'Title', 'Asset Code', 'Platform', 'Content Format', 'Content Pillar',
        'SSF Lane', 'CTA Final', 'Message Framework', 'Opening Line', 'Body',
        'Closing Prompt', 'Published At', 'Published URL', 'Upload Post Request ID',
        'Reach (48h)', 'Reach (7d)', 'Views (7d)', 'Likes (7d)', 'Comments (7d)',
        'Saves (7d)', 'Shares (7d)', 'Overall Score', 'Bottleneck',
        'Metrics (48h) Collected At', 'Metrics (7d) Collected At'
      ]
    });

    log.push(`Found ${allAssets.length} published assets with request_id`);

    // --------------------------------------------------------
    // 2. Collect 48h snapshots
    // --------------------------------------------------------
    const needs48h = allAssets.filter(a => {
      const f = a.fields;
      const hours = hoursAgo(f['Published At']);
      return hours >= 36 && hours <= 168 && !f['Metrics (48h) Collected At'];
    });

    log.push(`48h collection needed: ${needs48h.length} assets`);

    for (const asset of needs48h) {
      const f = asset.fields;
      const requestId = f['Upload Post Request ID'];
      const analytics = await getPostAnalytics(requestId);
      const metrics = extractMetrics(analytics);

      if (metrics) {
        await airtablePatch(ASSETS_TABLE, asset.id, {
          'Reach (48h)': metrics.reach,
          'Views (48h)': metrics.views,
          'Likes (48h)': metrics.likes,
          'Comments (48h)': metrics.comments,
          'Saves (48h)': metrics.saves,
          'Shares (48h)': metrics.shares,
          'Metrics (48h) Collected At': new Date().toISOString()
        });
        log.push(`  48h: ${f['Asset Code']} — R:${metrics.reach} V:${metrics.views} L:${metrics.likes}`);
      } else {
        errors.push(`48h failed: ${f['Asset Code']} (${requestId})`);
      }

      await sleep(500);
    }

    // --------------------------------------------------------
    // 3. Collect 7d snapshots + AI diagnosis
    // --------------------------------------------------------
    const needs7d = allAssets.filter(a => {
      const f = a.fields;
      const hours = hoursAgo(f['Published At']);
      return hours >= 144 && !f['Metrics (7d) Collected At'];
    });

    log.push(`7d collection needed: ${needs7d.length} assets`);

    for (const asset of needs7d) {
      const f = asset.fields;
      const requestId = f['Upload Post Request ID'];
      const analytics = await getPostAnalytics(requestId);
      const metrics = extractMetrics(analytics);

      if (metrics) {
        // Write 7d metrics
        const updateFields = {
          'Reach (7d)': metrics.reach,
          'Views (7d)': metrics.views,
          'Likes (7d)': metrics.likes,
          'Comments (7d)': metrics.comments,
          'Saves (7d)': metrics.saves,
          'Shares (7d)': metrics.shares,
          'Metrics (7d) Collected At': new Date().toISOString()
        };

        // Run AI diagnosis
        const metrics48h = {
          reach: f['Reach (48h)'] || 0,
          views: f['Views (48h)'] || 0,
          likes: f['Likes (48h)'] || 0,
          comments: f['Comments (48h)'] || 0,
          saves: f['Saves (48h)'] || 0,
          shares: f['Shares (48h)'] || 0,
        };

        const baselines = computeBaselines(allAssets, f.Platform, f['Content Format']);
        const diagnosis = await runAIDiagnosis(f, metrics48h, metrics, baselines);

        if (diagnosis) {
          updateFields['Overall Score'] = diagnosis.overall_score || 0;
          updateFields['Reach Score'] = diagnosis.reach_score || 0;
          updateFields['Depth Score'] = diagnosis.depth_score || 0;
          updateFields['Bottleneck'] = { name: diagnosis.bottleneck || 'Unclear' };
          updateFields['Bottleneck Confidence'] = { name: diagnosis.confidence || 'Low' };
          updateFields['Bottleneck Reasons'] = (diagnosis.reasons || []).map((r, i) => `${i + 1}. ${r}`).join('\n');
          updateFields['Fix Suggestions'] = (diagnosis.fixes || []).map((f, i) => `${i + 1}. ${f}`).join('\n');
          updateFields['Sequel Candidate'] = diagnosis.sequel_candidate || false;
          updateFields['Remix Candidate'] = diagnosis.remix_candidate || false;
          log.push(`  7d+AI: ${f['Asset Code']} — Score:${diagnosis.overall_score} Bottleneck:${diagnosis.bottleneck}`);
        } else {
          log.push(`  7d: ${f['Asset Code']} — metrics saved, AI diagnosis failed`);
        }

        await airtablePatch(ASSETS_TABLE, asset.id, updateFields);
      } else {
        errors.push(`7d failed: ${f['Asset Code']} (${requestId})`);
      }

      await sleep(500);
    }

    // --------------------------------------------------------
    // 4. Profile tracking
    // --------------------------------------------------------
    try {
      const profile = await getProfileAnalytics();
      const impressions = await getTotalImpressions();

      if (profile || impressions) {
        // Get the active Brand Codex record
        const codexRecords = await airtableQuery(CODEX_TABLE, {
          filterByFormula: `{Active Brand}=TRUE()`,
          maxRecords: '1'
        });

        if (codexRecords.length > 0) {
          const codexId = codexRecords[0].id;
          const profileFields = {};

          // Extract follower counts per platform from profile data
          if (profile) {
            const platforms = profile.data || profile.profiles || profile;
            if (Array.isArray(platforms)) {
              for (const p of platforms) {
                const name = (p.platform || p.name || '').toLowerCase();
                const followers = p.followers || p.follower_count || 0;
                if (name.includes('instagram')) profileFields['Followers Instagram (Current)'] = followers;
                if (name.includes('linkedin')) profileFields['Followers LinkedIn (Current)'] = followers;
                if (name.includes('facebook')) profileFields['Followers Facebook (Current)'] = followers;
                if (name.includes('thread')) profileFields['Followers Threads (Current)'] = followers;
                if (name.includes('youtube')) profileFields['Followers YouTube (Current)'] = followers;
              }
            }
          }

          // Extract impressions
          if (impressions) {
            const data = impressions.data || impressions;
            profileFields['Total Impressions (Current Week)'] = data.total_impressions || data.impressions || 0;
            profileFields['Total Reach (Current Week)'] = data.total_reach || data.reach || 0;
          }

          profileFields['Profile Metrics Updated At'] = new Date().toISOString();

          await airtablePatch(CODEX_TABLE, codexId, profileFields);
          log.push(`Profile metrics updated on Brand Codex`);
        }
      }
    } catch (err) {
      errors.push(`Profile tracking: ${err.message}`);
    }

    // --------------------------------------------------------
    // 5. Monday: Weekly report + snapshot rotation
    // --------------------------------------------------------
    if (dayOfWeek() === 1) {
      log.push('Monday detected — running weekly report');

      try {
        // Rotate Brand Codex snapshots
        const codexRecords = await airtableQuery(CODEX_TABLE, {
          filterByFormula: `{Active Brand}=TRUE()`,
          maxRecords: '1'
        });

        if (codexRecords.length > 0) {
          const codex = codexRecords[0];
          const cf = codex.fields;

          const rotationFields = {};
          const platforms = ['Instagram', 'LinkedIn', 'Facebook', 'Threads', 'YouTube'];

          for (const p of platforms) {
            // Last Month = average of Last Week and Last Month (rolling approximation)
            const lastWeek = cf[`Followers ${p} (Last Week)`] || 0;
            const lastMonth = cf[`Followers ${p} (Last Month)`] || 0;
            rotationFields[`Followers ${p} (Last Month)`] = lastMonth ? Math.round((lastMonth * 3 + lastWeek) / 4) : lastWeek;
            rotationFields[`Followers ${p} (Last Week)`] = cf[`Followers ${p} (Current)`] || 0;
          }

          // Impressions rotation
          const impCurrent = cf['Total Impressions (Current Week)'] || 0;
          const impLastWeek = cf['Total Impressions (Last Week)'] || 0;
          const impLastMonth = cf['Total Impressions (Last Month Avg)'] || 0;
          rotationFields['Total Impressions (Last Month Avg)'] = impLastMonth ? Math.round((impLastMonth * 3 + impLastWeek) / 4) : impLastWeek;
          rotationFields['Total Impressions (Last Week)'] = impCurrent;

          const reachCurrent = cf['Total Reach (Current Week)'] || 0;
          const reachLastWeek = cf['Total Reach (Last Week)'] || 0;
          const reachLastMonth = cf['Total Reach (Last Month Avg)'] || 0;
          rotationFields['Total Reach (Last Month Avg)'] = reachLastMonth ? Math.round((reachLastMonth * 3 + reachLastWeek) / 4) : reachLastWeek;
          rotationFields['Total Reach (Last Week)'] = reachCurrent;

          await airtablePatch(CODEX_TABLE, codex.id, rotationFields);
          log.push('Brand Codex snapshots rotated');

          // Build weekly Telegram report
          const thisWeekAssets = allAssets.filter(a => {
            const hours = hoursAgo(a.fields['Published At']);
            return hours <= 168 && a.fields['Overall Score'];
          });

          // Follower summary
          let followerLines = '';
          for (const p of platforms) {
            const current = cf[`Followers ${p} (Current)`] || 0;
            const lastW = cf[`Followers ${p} (Last Week)`] || 0;
            if (current > 0) {
              const diff = current - lastW;
              const sign = diff >= 0 ? '+' : '';
              followerLines += `  ${p}: ${current.toLocaleString()} (${sign}${diff} this week)\n`;
            }
          }

          // Top posts
          const ranked = [...thisWeekAssets]
            .sort((a, b) => (b.fields['Overall Score'] || 0) - (a.fields['Overall Score'] || 0));
          const top3 = ranked.slice(0, 3);
          let topLines = '';
          top3.forEach((a, i) => {
            const f = a.fields;
            topLines += `${i + 1}. ${f['Asset Code']} — ${f.Platform} ${f['Content Format']} — Score: ${f['Overall Score']} (${f.Bottleneck || '?'})\n   "${(f.Title || '').substring(0, 50)}"\n`;
          });

          // Needs attention
          const needsAttention = ranked.filter(a => a.fields.Bottleneck && a.fields.Bottleneck !== 'Winner').slice(-2);
          let attentionLines = '';
          needsAttention.forEach(a => {
            const f = a.fields;
            attentionLines += `- ${f['Asset Code']} "${(f.Title || '').substring(0, 40)}" — ${f.Bottleneck}: ${(f['Bottleneck Reasons'] || '').split('\n')[0]}\n`;
          });

          // AI weekly insights
          const aiInsights = thisWeekAssets.length >= 2
            ? await runWeeklyAnalysis(thisWeekAssets)
            : 'Not enough diagnosed posts this week for pattern analysis.';

          const message = `📊 Weekly Performance Report\n\n` +
            `👥 Followers:\n${followerLines || '  No data yet\n'}\n` +
            `📈 Impressions:\n  This week: ${(impCurrent || 0).toLocaleString()} (${pctChange(impCurrent, impLastWeek)} vs last week)\n\n` +
            `🏆 Top Posts:\n${topLines || '  No diagnosed posts this week\n'}\n` +
            `⚠️ Needs Attention:\n${attentionLines || '  Nothing flagged\n'}\n` +
            `🧠 AI Insights:\n${aiInsights}`;

          await sendTelegram(message);
          log.push('Weekly Telegram report sent');
        }
      } catch (err) {
        errors.push(`Weekly report: ${err.message}`);
      }
    }

    // --------------------------------------------------------
    // Done
    // --------------------------------------------------------
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const summary = {
      ok: true,
      duration: `${duration}s`,
      collected_48h: needs48h.length,
      collected_7d: needs7d.length,
      total_assets: allAssets.length,
      is_monday: dayOfWeek() === 1,
      log,
      errors
    };

    console.log(JSON.stringify(summary, null, 2));
    return res.status(200).json(summary);

  } catch (err) {
    console.error('Fatal error:', err);
    return res.status(500).json({ ok: false, error: err.message, log, errors });
  }
};
