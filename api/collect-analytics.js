/**
 * Phase 5: Analytics Collector + AI Diagnosis + Monthly Reports
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
 * 7. On 1st of month: per-platform monthly analysis → 05_Monthly Reports + Brand Codex Performance Intelligence
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
const MONTHLY_TABLE = 'tbl1jFli7lkff50Rf';

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

function previousMonth() {
  const now = new Date();
  const y = now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
  const m = now.getUTCMonth() === 0 ? 12 : now.getUTCMonth(); // getUTCMonth is 0-based
  return `${y}-${String(m).padStart(2, '0')}`;
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

async function airtableCreate(tableId, fields) {
  const baseId = getEnv('AIRTABLE_BASE_ID');
  const token = getEnv('AIRTABLE_TOKEN');

  const resp = await fetch(`${AIRTABLE_BASE_URL}/${baseId}/${tableId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields, typecast: true })
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Airtable create failed: ${resp.status} ${text.substring(0, 200)}`);
  }
  return resp.json();
}

// ============================================================
// UPLOAD POST ANALYTICS API
// ============================================================

async function getPostAnalytics(requestId) {
  const apiKey = getEnv('UPLOAD_POST_API_KEY');

  const resp = await fetch(`${UPLOAD_POST_BASE}/api/uploadposts/post-analytics/${requestId}`, {
    headers: { 'Authorization': `Apikey ${apiKey}` }
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
  const username = getEnv('UPLOAD_POST_USERNAME'); // e.g. "@bastiangugger"

  const resp = await fetch(
    `${UPLOAD_POST_BASE}/api/analytics/${encodeURIComponent(username)}?platforms=instagram,linkedin,threads`,
    { headers: { 'Authorization': `Apikey ${apiKey}` } }
  );

  if (!resp.ok) {
    const text = await resp.text();
    console.error(`Profile analytics failed: ${resp.status} ${text.substring(0, 200)}`);
    return null;
  }

  return resp.json();
}

async function getTotalImpressions() {
  const apiKey = getEnv('UPLOAD_POST_API_KEY');
  const username = getEnv('UPLOAD_POST_USERNAME');

  const resp = await fetch(
    `${UPLOAD_POST_BASE}/api/uploadposts/total-impressions/${encodeURIComponent(username)}?period=last_week`,
    { headers: { 'Authorization': `Apikey ${apiKey}` } }
  );

  if (!resp.ok) {
    // This endpoint may not work for all accounts — not critical
    console.error(`Total impressions failed: ${resp.status} (non-critical)`);
    return null;
  }

  return resp.json();
}

// ============================================================
// EXTRACT METRICS FROM UPLOAD POST RESPONSE
// ============================================================

function extractMetrics(analyticsData) {
  if (!analyticsData) return null;

  // Post analytics returns per-platform objects with post metrics
  // Each platform has: post metadata + live metrics + profile snapshots
  let reach = 0, views = 0, likes = 0, comments = 0, saves = 0, shares = 0;

  // The response may be { instagram: { metrics: {...} }, linkedin: {...} }
  // or it may have a wrapper like { data: {...} }
  const data = analyticsData.data || analyticsData;

  for (const [platform, entry] of Object.entries(data)) {
    if (!entry || typeof entry !== 'object' || entry.success === false) continue;

    // Try to find metrics in nested structures
    const m = entry.metrics || entry.live_metrics || entry;

    reach += m.reach || m.impressions || 0;
    views += m.views || m.plays || m.video_views || m.impressions || 0;
    likes += m.likes || m.reactions || 0;
    comments += m.comments || m.replies || 0;
    saves += m.saves || m.bookmarks || 0;
    shares += m.shares || m.reposts || m.retweets || 0;
  }

  // If nothing was extracted, return null
  if (reach === 0 && views === 0 && likes === 0 && comments === 0 && saves === 0 && shares === 0) {
    return null;
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
// MONTHLY PER-PLATFORM ANALYSIS
// ============================================================

const MONTHLY_SYSTEM_PROMPT = `You are a social media performance coach. You just reviewed a full month of content for one specific platform. Your job is to tell the creator exactly what's working, what's not, and what to do next month.

RULES:
- Write like you're talking to a smart friend, not a marketing textbook. 8th grade reading level.
- Every claim MUST reference a specific post by its Asset Code and title. No vague statements.
- Use real numbers from the data. "A0340 got 2,400 reach vs your average of 800" is good. "Reach was above average" is bad.
- Be honest. If something flopped, say so clearly and explain why in plain language.
- Focus on patterns, not individual posts. One post bombing doesn't mean a pattern. Three posts with the same hook style bombing IS a pattern.

You will receive a list of all diagnosed posts for this platform from the past month, including:
- Title, hook/opening line, body excerpt, CTA, pillar, format, SSF lane
- 48h and 7d metrics (reach, views, likes, comments, saves, shares)
- AI diagnosis (score, bottleneck, reasons)

Return ONLY valid JSON with this exact structure:
{
  "whats_working": "2-4 paragraphs. Start each pattern with a clear statement, then back it up with specific posts. Example: 'Curiosity-gap hooks are your best move on this platform. A0340 \"What nobody tells you about...\" hit 2,400 reach — that is 3x your average. A0355 used the same style and got 1,800. Compare that to A0312 which used a listicle hook and only got 400.'",
  "whats_not_working": "2-4 paragraphs. Same format — name the pattern, show the posts that prove it, explain WHY it is not working in simple terms.",
  "optimization_rules": "Write in three sections:\n\nKEEP DOING:\n- Rule 1 (backed by data)\n- Rule 2\n\nSTOP DOING:\n- Rule 1 (backed by data)\n- Rule 2\n\nTRY NEXT MONTH:\n- Experiment 1 (why it might work based on what you see)\n- Experiment 2",
  "best_performers": "Top 3 posts. For each: Asset Code, title, score, and 1-2 sentences on what made it work. Be specific about the hook, body structure, or CTA that drove results.",
  "underperformers": "Bottom 3 posts. For each: Asset Code, title, score, what went wrong, and exactly how to fix it. Give a rewritten hook or restructured approach — not generic advice.",
  "content_mix": "Based on the data, what should the mix look like next month? More of which pillars? Which formats? Which CTAs? Which posting days? Be specific with numbers: 'Post 3 Authority carousels instead of 1. Drop Reels from 4 to 2 until hooks improve.'",
  "monthly_focus": "ONE sentence. The single most important thing to focus on next month. Make it concrete and actionable. Example: 'Rewrite every Reel hook as a question instead of a statement — your question hooks get 2.5x more views.'",
  "performance_intelligence": "5-8 bullet points in this exact format, designed to be injected into a content creation AI:\n\nKEEP DOING:\n- Pattern (backed by data)\n\nSTOP DOING:\n- Pattern (backed by data)\n\nTRY:\n- Experiment (why)"
}

CRITICAL: The "performance_intelligence" field gets fed directly into the content creation pipeline. It must be concise, specific, and actionable. The AI creating content will read these rules and follow them. Bad example: "Improve hooks". Good example: "Use curiosity-gap hooks (questions or surprising statements) — they get 2.5x more views than listicle hooks on Instagram."`;

async function runMonthlyAnalysis(platformAssets, platform) {
  const apiKey = getEnv('OPENROUTER_API_KEY');

  // Build detailed post summaries for the AI
  const postSummaries = platformAssets.map(a => {
    const f = a.fields;
    return `---
Asset Code: ${f['Asset Code'] || '?'}
Title: ${f.Title || '?'}
Platform: ${f.Platform || '?'}
Format: ${f['Content Format'] || '?'}
Pillar: ${f['Content Pillar'] || '?'}
SSF Lane: ${f['SSF Lane'] || '?'}
CTA: ${f['CTA Final'] || 'None'}
Hook: ${f['Opening Line'] || 'N/A'}
Body (excerpt): ${(f.Body || '').substring(0, 500) || 'N/A'}
Published: ${f['Published At'] || '?'}
48h — Reach: ${f['Reach (48h)'] || 0}, Views: ${f['Views (48h)'] || 0}, Likes: ${f['Likes (48h)'] || 0}, Comments: ${f['Comments (48h)'] || 0}, Saves: ${f['Saves (48h)'] || 0}, Shares: ${f['Shares (48h)'] || 0}
7d — Reach: ${f['Reach (7d)'] || 0}, Views: ${f['Views (7d)'] || 0}, Likes: ${f['Likes (7d)'] || 0}, Comments: ${f['Comments (7d)'] || 0}, Saves: ${f['Saves (7d)'] || 0}, Shares: ${f['Shares (7d)'] || 0}
Score: ${f['Overall Score'] || '?'} | Bottleneck: ${f.Bottleneck || '?'} | Confidence: ${f['Bottleneck Confidence'] || '?'}
Diagnosis: ${f['Bottleneck Reasons'] || 'N/A'}`;
  }).join('\n');

  // Compute platform averages
  const scored = platformAssets.filter(a => a.fields['Overall Score']);
  const avgScore = scored.length > 0
    ? (scored.reduce((s, a) => s + (a.fields['Overall Score'] || 0), 0) / scored.length).toFixed(1)
    : 'N/A';
  const totalReach = platformAssets.reduce((s, a) => s + (a.fields['Reach (7d)'] || 0), 0);
  const avgReach = platformAssets.length > 0 ? Math.round(totalReach / platformAssets.length) : 0;

  const userPrompt = `## Monthly Analysis: ${platform}
## Period: ${previousMonth()}
## Posts: ${platformAssets.length} total, ${scored.length} with diagnosis
## Platform Averages: Score ${avgScore}, Reach ${avgReach}

Here is every post from this platform last month:

${postSummaries}

Analyze all of these posts together. Find the patterns. Be specific — use Asset Codes and real numbers. Write at an 8th grade level. Return ONLY the JSON object.`;

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
          { role: 'system', content: MONTHLY_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.4,
        max_tokens: 4000
      })
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error(`Monthly analysis failed for ${platform}: ${resp.status} ${text.substring(0, 200)}`);
      return null;
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || '';

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error(`Monthly analysis for ${platform} not valid JSON:`, content.substring(0, 300));
      return null;
    }

    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error(`Monthly analysis error for ${platform}:`, err.message);
    return null;
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

      if (profile) {
        // Get the active Brand Codex record
        const codexRecords = await airtableQuery(CODEX_TABLE, {
          filterByFormula: `{Active Brand}=TRUE()`,
          maxRecords: '1'
        });

        if (codexRecords.length > 0) {
          const codexId = codexRecords[0].id;
          const profileFields = {};

          // Profile response is { instagram: { followers: N, reach: N, impressions: N, ... }, linkedin: {...}, ... }
          const platformMap = {
            instagram: 'Instagram',
            linkedin: 'LinkedIn',
            facebook: 'Facebook',
            threads: 'Threads',
            youtube: 'YouTube'
          };

          let totalImpressions = 0;
          let totalReach = 0;

          for (const [key, label] of Object.entries(platformMap)) {
            const data = profile[key];
            if (data && data.success !== false && data.followers !== undefined) {
              profileFields[`Followers ${label} (Current)`] = data.followers || 0;
              totalImpressions += data.impressions || 0;
              totalReach += data.reach || 0;
              log.push(`  ${label}: ${data.followers} followers, ${data.reach || 0} reach`);
            }
          }

          profileFields['Total Impressions (Current Week)'] = totalImpressions;
          profileFields['Total Reach (Current Week)'] = totalReach;
          profileFields['Profile Metrics Updated At'] = new Date().toISOString();

          await airtablePatch(CODEX_TABLE, codexId, profileFields);
          log.push(`Profile metrics updated on Brand Codex`);
        } else {
          log.push('No active Brand Codex record found');
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
    // 6. 1st of month: Monthly per-platform analysis
    // --------------------------------------------------------
    if (new Date().getUTCDate() === 1) {
      log.push('1st of month — running monthly per-platform analysis');

      try {
        const month = previousMonth();

        // Query ALL diagnosed assets from last month (not just ones with request_id)
        const monthAssets = await airtableQuery(ASSETS_TABLE, {
          filterByFormula: `AND({Asset Status}="Published", {Overall Score}!=BLANK(), DATETIME_FORMAT({Published At}, 'YYYY-MM')="${month}")`,
          'fields[]': [
            'Title', 'Asset Code', 'Platform', 'Content Format', 'Content Pillar',
            'SSF Lane', 'CTA Final', 'Opening Line', 'Body', 'Published At',
            'Reach (48h)', 'Views (48h)', 'Likes (48h)', 'Comments (48h)', 'Saves (48h)', 'Shares (48h)',
            'Reach (7d)', 'Views (7d)', 'Likes (7d)', 'Comments (7d)', 'Saves (7d)', 'Shares (7d)',
            'Overall Score', 'Bottleneck', 'Bottleneck Confidence', 'Bottleneck Reasons'
          ]
        });

        log.push(`  Found ${monthAssets.length} diagnosed assets for ${month}`);

        // Group by platform
        const byPlatform = {};
        for (const a of monthAssets) {
          const p = a.fields.Platform || 'Unknown';
          if (!byPlatform[p]) byPlatform[p] = [];
          byPlatform[p].push(a);
        }

        // Get Brand Codex for writing Performance Intelligence
        const codexRecords = await airtableQuery(CODEX_TABLE, {
          filterByFormula: `{Active Brand}=TRUE()`,
          maxRecords: '1'
        });
        const codexId = codexRecords.length > 0 ? codexRecords[0].id : null;
        const intelligenceFields = {};

        // Run analysis per platform (min 3 posts to be meaningful)
        const platforms = ['Instagram', 'LinkedIn', 'Threads', 'Facebook'];
        for (const platform of platforms) {
          const assets = byPlatform[platform];
          if (!assets || assets.length < 3) {
            log.push(`  ${platform}: ${assets ? assets.length : 0} posts — skipping (need 3+)`);
            continue;
          }

          log.push(`  ${platform}: analyzing ${assets.length} posts...`);
          const analysis = await runMonthlyAnalysis(assets, platform);

          if (analysis) {
            // Compute summary stats
            const scored = assets.filter(a => a.fields['Overall Score']);
            const avgScore = scored.length > 0
              ? Number((scored.reduce((s, a) => s + (a.fields['Overall Score'] || 0), 0) / scored.length).toFixed(1))
              : 0;
            const totalReach = assets.reduce((s, a) => s + (a.fields['Reach (7d)'] || 0), 0);
            const avgSaves = scored.length > 0
              ? Number((scored.reduce((s, a) => s + (a.fields['Saves (7d)'] || 0), 0) / scored.length).toFixed(1))
              : 0;

            // Write to Monthly Reports table
            await airtableCreate(MONTHLY_TABLE, {
              'Month': month,
              'Platform': { name: platform },
              'Posts Analyzed': assets.length,
              'Avg Overall Score': avgScore,
              'Avg Reach': Math.round(totalReach / assets.length),
              'Avg Saves': avgSaves,
              'Total Reach': totalReach,
              'What\'s Working': analysis.whats_working || '',
              'What\'s Not Working': analysis.whats_not_working || '',
              'Optimization Rules': analysis.optimization_rules || '',
              'Best Performers': analysis.best_performers || '',
              'Underperformers': analysis.underperformers || '',
              'Content Mix Recommendation': analysis.content_mix || '',
              'Monthly Optimization Focus': analysis.monthly_focus || '',
              'Report Generated At': new Date().toISOString()
            });

            log.push(`  ${platform}: monthly report saved to Airtable`);

            // Store Performance Intelligence for pipeline feedback
            if (analysis.performance_intelligence) {
              intelligenceFields[`Performance Intelligence (${platform})`] =
                `${platform.toUpperCase()} — ${month}\n\n${analysis.performance_intelligence}`;
            }
          } else {
            errors.push(`Monthly analysis failed for ${platform}`);
          }

          await sleep(1000); // Rate limit between AI calls
        }

        // Write Performance Intelligence to Brand Codex
        if (codexId && Object.keys(intelligenceFields).length > 0) {
          intelligenceFields['Performance Intelligence Updated At'] = new Date().toISOString();
          await airtablePatch(CODEX_TABLE, codexId, intelligenceFields);
          log.push(`Performance Intelligence updated on Brand Codex (${Object.keys(intelligenceFields).length - 1} platforms)`);
        }

        // Send monthly Telegram summary
        let monthMsg = `📊 Monthly Performance Report — ${month}\n\n`;
        for (const platform of platforms) {
          const assets = byPlatform[platform];
          if (!assets || assets.length < 3) continue;
          const scored = assets.filter(a => a.fields['Overall Score']);
          const avgScore = scored.length > 0
            ? (scored.reduce((s, a) => s + (a.fields['Overall Score'] || 0), 0) / scored.length).toFixed(0)
            : '?';
          const totalReach = assets.reduce((s, a) => s + (a.fields['Reach (7d)'] || 0), 0);
          monthMsg += `${platform}: ${assets.length} posts, avg score ${avgScore}, total reach ${totalReach.toLocaleString()}\n`;
        }
        monthMsg += `\nFull per-platform analysis saved to 05_Monthly Reports in Airtable.`;
        monthMsg += `\nPerformance Intelligence updated — Content Pipeline will use these insights.`;
        await sendTelegram(monthMsg);
        log.push('Monthly Telegram summary sent');

      } catch (err) {
        errors.push(`Monthly analysis: ${err.message}`);
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
      is_first_of_month: new Date().getUTCDate() === 1,
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
