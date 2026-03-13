// ============================================================
// ACNS EEG Classifier — app.js
// ============================================================

// --------------- SYSTEM PROMPT ---------------
const SYSTEM_PROMPT = `You are an expert clinical neurophysiologist. You will analyze an EEG screenshot using the ACNS (American Clinical Neurophysiology Society) 2021 standardized critical care EEG terminology.

## ACNS Main Terms

**Term 1 — Localization:**
- G = Generalized
- L = Lateralized
- BI = Bilateral Independent
- UI = Unilateral Independent
- Mf = Multifocal

**Term 2 — Pattern type:**
- PDs = Periodic Discharges
- RDA = Rhythmic Delta Activity
- SW = Spike-and-Wave (or Sharp-and-Wave)

**Full labels** combine Term 1 + Term 2: LPD, GPD, LRDA, GRDA, BIPD, etc.

## Modifiers

**Prevalence:**
- Continuous: ≥90% of epoch
- Abundant: 50–89%
- Frequent: 10–49%
- Occasional: 1–9%
- Rare: <1%

**Frequency:** Measure using 1-second vertical gridlines. Bins: 0.5–4.0 Hz.

**Plus modifiers** (significantly increase seizure risk):
- +F = superimposed Fast activity
- +R = superimposed Rhythmic activity
- +S = superimposed Sharp waves/spikes
- +FR, +FS = combinations

**Evolution:** Definite progressive change in frequency, morphology, or location over ≥10 seconds. Required for electrographic seizure classification.

## Clinical Category Thresholds (apply in order)

1. **ESz (Electrographic Seizure):** Frequency >2.5 Hz for ≥10 seconds OR definite evolution ≥10 seconds
2. **ESE (Electrographic Status Epilepticus):** ESz continuous >10 minutes OR >20% of any 60-minute epoch
3. **IIC (Ictal-Interictal Continuum):**
   - PD or SW at 1.0–2.5 Hz; OR
   - PD or SW at 0.5–1.0 Hz WITH any Plus modifier; OR
   - LRDA >1 Hz WITH any Plus modifier
4. **RPP (Rhythmic/Periodic Pattern):** PD or RDA present but below IIC thresholds
5. **None:** No rhythmic or periodic patterns identified

## Seizure Risk Data (Rodriguez Ruiz et al., JAMA Neurol 2017)

| Pattern | Overall | <1.5 Hz | 1.5–2 Hz | ≥2 Hz | With Plus |
|---------|---------|---------|----------|-------|-----------|
| LPD     | 44%     | 40%     | 50%      | 66%   | 58%       |
| LRDA    | 28%     | 17%     | 24%      | 40%   | 40%       |
| GPD     | 16%     | 14%     | 24%      | 32%   | 28%       |
| GRDA    | 13%     | —       | —        | —     | NS        |
| BIPD    | 28%     | —       | —        | —     | trend     |
| No pattern | 6%   | —       | —        | —     | —         |

For borderline frequencies, interpolate and provide a risk range.

## Confidence Calibration
- 90–100%: Pattern unambiguous, clear EEG
- 70–89%: Minor uncertainty about one modifier
- 50–69%: Probable but image quality limits certainty
- <50%: Significant ambiguity — recommend formal neurophysiologist review

## Instructions

1. Assess image quality first. If the image is not an EEG or is completely uninterpretable, set image_quality.interpretable to false and provide minimal remaining fields.
2. Describe the background activity.
3. Identify any rhythmic or periodic patterns using ACNS terminology.
4. Classify into the appropriate clinical category.
5. Estimate seizure risk based on the Rodriguez Ruiz data.
6. Write a 2–3 sentence balanced clinical summary.

**Output format:**
First, write a REASONING section (150–300 words) explaining your analysis step by step.
Then output a JSON block in a \`\`\`json code fence with EXACTLY this schema:

\`\`\`json
{
  "image_quality": {
    "interpretable": true,
    "montage": "string or unknown",
    "artifacts": [],
    "quality_notes": "string"
  },
  "background": {
    "dominant_frequency_hz": 0.0,
    "voltage": "low|normal|high",
    "continuity": "continuous|nearly continuous|discontinuous|burst-suppression|suppressed",
    "symmetry": "symmetric|asymmetric",
    "reactivity": "present|absent|not tested|unknown"
  },
  "pattern": {
    "present": true,
    "main_term_1": "G|L|BI|UI|Mf|none",
    "main_term_2": "PDs|RDA|SW|none",
    "full_label": "string e.g. LPD",
    "frequency_hz": 0.0,
    "prevalence": "continuous|abundant|frequent|occasional|rare",
    "morphology": "blunt|sharply contoured|sharp|spike|triphasic",
    "phases": "monophasic|biphasic|triphasic|polyphasic",
    "plus_modifiers": [],
    "evolution": "evolving|fluctuating|static|none",
    "stimulus_induced": false,
    "lateralization": "left|right|bilateral|generalized|N/A",
    "pattern_probability": 0,
    "pattern_confidence": 0
  },
  "clinical_category": {
    "category": "ESz|ESE|IIC|RPP|None",
    "criteria_met": [],
    "category_probability": 0,
    "category_confidence": 0
  },
  "seizure_risk": {
    "applicable": true,
    "estimated_risk_percent": 0,
    "risk_range": "string e.g. 40-50%",
    "source_pattern": "string e.g. LPD at 1.3 Hz",
    "literature_reference": "Rodriguez Ruiz et al., JAMA Neurol 2017"
  },
  "summary": "2-3 sentence clinical summary."
}
\`\`\``;

const USER_PROMPT = `Analyze this EEG screenshot using ACNS 2021 standardized terminology. Provide your REASONING section followed by the JSON output in the exact schema specified.`;

// --------------- CONFIGURATION ---------------
// Set PROXY_URL to your Cloudflare Worker URL to enable proxy mode.
// When set, the API key section is hidden and all requests go through the proxy.
// When empty/null, users must provide their own API key (direct mode).
const PROXY_URL = '';  // e.g. 'https://eeg-proxy.your-subdomain.workers.dev'

// --------------- DOM REFERENCES ---------------
const apiKeySection = document.getElementById('api-key-section');
const apiKeyInput = document.getElementById('api-key-input');
const saveKeyBtn = document.getElementById('save-key-btn');
const keyStatus = document.getElementById('key-status');
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const preview = document.getElementById('preview');
const analyzeBtn = document.getElementById('analyze-btn');
const loading = document.getElementById('loading');
const errorBanner = document.getElementById('error-banner');
const reportSection = document.getElementById('report-section');
const reportTimestamp = document.getElementById('report-timestamp');
const reasoningText = document.getElementById('reasoning-text');
const rawJsonText = document.getElementById('raw-json-text');
const printBtn = document.getElementById('print-btn');
const rateLimitInfo = document.getElementById('rate-limit-info');

// --------------- STATE ---------------
let imageData = null;   // { media_type, data (base64) }

// --------------- API KEY ---------------
function isProxyMode() {
  return !!PROXY_URL;
}

function loadSavedKey() {
  if (isProxyMode()) {
    apiKeySection.hidden = true;
    updateAnalyzeBtn();
    return;
  }
  const saved = sessionStorage.getItem('anthropic_api_key');
  if (saved) {
    apiKeyInput.value = saved;
    keyStatus.textContent = 'Key loaded from session.';
    updateAnalyzeBtn();
  }
}

saveKeyBtn.addEventListener('click', () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    keyStatus.textContent = 'Please enter a key.';
    keyStatus.style.color = 'var(--red)';
    return;
  }
  sessionStorage.setItem('anthropic_api_key', key);
  keyStatus.textContent = 'Key saved for this session.';
  keyStatus.style.color = 'var(--green)';
  updateAnalyzeBtn();
});

// --------------- FILE UPLOAD ---------------
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});

fileInput.addEventListener('change', () => {
  if (fileInput.files.length) handleFile(fileInput.files[0]);
});

function handleFile(file) {
  if (!file.type.startsWith('image/')) {
    showError('Please upload an image file.');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    const [header, base64] = dataUrl.split(',');
    const mediaType = header.match(/data:(.*?);/)[1];
    imageData = { media_type: mediaType, data: base64 };
    preview.src = dataUrl;
    preview.hidden = false;
    dropZone.style.display = 'none';
    updateAnalyzeBtn();
  };
  reader.readAsDataURL(file);
}

function updateAnalyzeBtn() {
  const hasKey = isProxyMode() || !!sessionStorage.getItem('anthropic_api_key');
  analyzeBtn.disabled = !(hasKey && imageData);
}

// --------------- ERROR HANDLING ---------------
function showError(msg) {
  errorBanner.textContent = msg;
  errorBanner.hidden = false;
}

function clearError() {
  errorBanner.hidden = true;
  errorBanner.textContent = '';
}

// --------------- ANALYZE ---------------
analyzeBtn.addEventListener('click', analyze);

async function analyze() {
  clearError();
  reportSection.hidden = true;
  loading.hidden = false;
  analyzeBtn.disabled = true;

  const apiKey = sessionStorage.getItem('anthropic_api_key');
  if (!isProxyMode() && (!apiKey || !imageData)) {
    showError('Missing API key or image.');
    loading.hidden = true;
    analyzeBtn.disabled = false;
    return;
  }
  if (!imageData) {
    showError('Missing image.');
    loading.hidden = true;
    analyzeBtn.disabled = false;
    return;
  }

  const requestBody = JSON.stringify({
    model: 'claude-opus-4-6',
    max_tokens: 3000,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: imageData.media_type, data: imageData.data } },
        { type: 'text', text: USER_PROMPT }
      ]
    }]
  });

  try {
    let res;
    if (isProxyMode()) {
      // Proxy mode — key is stored on the worker, not sent from browser
      res = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody
      });
    } else {
      // Direct mode — user's own API key
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: requestBody
      });
    }

    // Handle rate limit (429)
    if (res.status === 429) {
      const errData = await res.json();
      showError(errData.message || 'Daily limit reached. Please try again tomorrow.');
      return;
    }

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`API error ${res.status}: ${errBody}`);
    }

    // Show remaining uses if proxy sends rate limit headers
    const remaining = res.headers.get('X-RateLimit-Remaining');
    const limit = res.headers.get('X-RateLimit-Limit');
    if (remaining !== null && rateLimitInfo) {
      rateLimitInfo.textContent = `${remaining} of ${limit} analyses remaining today`;
      rateLimitInfo.hidden = false;
    }

    const result = await res.json();
    const text = result.content[0].text;
    processResponse(text);
  } catch (err) {
    showError(err.message);
  } finally {
    loading.hidden = true;
    analyzeBtn.disabled = false;
  }
}

// --------------- RESPONSE PROCESSING ---------------
function processResponse(text) {
  // Extract reasoning (everything before ```json)
  let reasoning = '';
  let jsonStr = '';

  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    reasoning = text.substring(0, text.indexOf('```json')).trim();
    jsonStr = jsonMatch[1];
  } else {
    // Fallback: try to find raw JSON object
    const braceMatch = text.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      reasoning = text.substring(0, text.indexOf('{')).trim();
      jsonStr = braceMatch[0];
    } else {
      showError('Could not extract JSON from AI response.');
      reasoningText.textContent = text;
      document.getElementById('reasoning-section').open = true;
      reportSection.hidden = false;
      return;
    }
  }

  // Remove REASONING: prefix if present
  reasoning = reasoning.replace(/^REASONING:\s*/i, '').trim();

  let data;
  try {
    data = JSON.parse(jsonStr);
  } catch (e) {
    showError('Failed to parse JSON response: ' + e.message);
    reasoningText.textContent = text;
    document.getElementById('reasoning-section').open = true;
    reportSection.hidden = false;
    return;
  }

  renderReport(data, reasoning, jsonStr);
}

// --------------- REPORT RENDERING ---------------
function renderReport(data, reasoning, jsonStr) {
  reportTimestamp.textContent = 'Generated: ' + new Date().toLocaleString();
  reasoningText.textContent = reasoning;
  rawJsonText.textContent = JSON.stringify(data, null, 2);

  renderPatternCard(data);
  renderCategoryCard(data);
  renderRiskCard(data);
  renderSummaryCard(data);

  reportSection.hidden = false;
  reportSection.scrollIntoView({ behavior: 'smooth' });
}

function renderPatternCard(data) {
  const card = document.getElementById('pattern-card');
  const body = card.querySelector('.card-body');
  const p = data.pattern;
  const iq = data.image_quality;

  if (!iq.interpretable) {
    body.innerHTML = `<span class="badge badge-gray">Not Interpretable</span>
      <p>${escHtml(iq.quality_notes || 'Image could not be interpreted.')}</p>`;
    return;
  }

  if (!p.present) {
    body.innerHTML = `<span class="badge badge-green">No Pattern</span>
      <p>No rhythmic or periodic patterns identified.</p>`;
    applyCategoryClass(card, 'none');
    return;
  }

  const plusStr = p.plus_modifiers && p.plus_modifiers.length ? ' ' + p.plus_modifiers.join(', ') : '';
  const confWarning = p.pattern_confidence < 60
    ? `<div class="confidence-warning">Low confidence (${p.pattern_confidence}%) — recommend formal neurophysiologist review</div>`
    : '';

  body.innerHTML = `
    <span class="badge ${categoryBadgeClass(data.clinical_category.category)}">${escHtml(p.full_label)}${plusStr}</span>
    <p><span class="label">Frequency:</span> ${p.frequency_hz} Hz</p>
    <p><span class="label">Prevalence:</span> ${escHtml(p.prevalence)}</p>
    <p><span class="label">Morphology:</span> ${escHtml(p.morphology)} (${escHtml(p.phases)})</p>
    <p><span class="label">Evolution:</span> ${escHtml(p.evolution)}</p>
    ${p.stimulus_induced ? '<p><span class="label">Stimulus-induced</span></p>' : ''}
    ${probBar('Pattern probability', p.pattern_probability)}
    ${probBar('Confidence', p.pattern_confidence)}
    ${confWarning}
  `;
}

function renderCategoryCard(data) {
  const card = document.getElementById('category-card');
  const body = card.querySelector('.card-body');
  const cc = data.clinical_category;

  const catClass = cc.category.toLowerCase().replace(/\s/g, '');
  applyCategoryClass(card, catClass);

  const confWarning = cc.category_confidence < 60
    ? `<div class="confidence-warning">Low confidence (${cc.category_confidence}%) — recommend formal neurophysiologist review</div>`
    : '';

  body.innerHTML = `
    <span class="badge ${categoryBadgeClass(cc.category)}">${escHtml(cc.category)}</span>
    <p class="label">Criteria met:</p>
    <ul>${(cc.criteria_met || []).map(c => `<li>${escHtml(c)}</li>`).join('')}</ul>
    ${probBar('Category probability', cc.category_probability)}
    ${probBar('Confidence', cc.category_confidence)}
    ${confWarning}
  `;
}

function renderRiskCard(data) {
  const card = document.getElementById('risk-card');
  const body = card.querySelector('.card-body');
  const sr = data.seizure_risk;
  const cat = data.clinical_category.category;

  // Show risk for IIC, RPP, or whenever applicable
  if (!sr || !sr.applicable) {
    if (cat === 'ESz' || cat === 'ESE') {
      body.innerHTML = `<span class="badge badge-red">Active Seizure</span>
        <p>Seizure risk estimation not applicable — electrographic seizure activity identified.</p>`;
      applyCategoryClass(card, cat.toLowerCase());
    } else {
      body.innerHTML = `<p>No seizure risk data applicable for this pattern.</p>`;
      applyCategoryClass(card, 'none');
    }
    return;
  }

  const risk = sr.estimated_risk_percent;
  const badgeClass = risk >= 45 ? 'badge-red' : risk >= 20 ? 'badge-amber' : 'badge-green';
  applyCategoryClass(card, cat.toLowerCase());

  body.innerHTML = `
    <span class="badge ${badgeClass}">${escHtml(sr.risk_range || risk + '%')}</span>
    <p><span class="label">Source:</span> ${escHtml(sr.source_pattern)}</p>
    <p><span class="label">Reference:</span> ${escHtml(sr.literature_reference)}</p>
    ${probBar('Estimated risk', risk)}
  `;
}

function renderSummaryCard(data) {
  const card = document.getElementById('summary-card');
  const body = card.querySelector('.card-body');
  const bg = data.background;

  body.innerHTML = `
    <p>${escHtml(data.summary)}</p>
    <hr style="margin: 0.5rem 0; border: none; border-top: 1px solid var(--border);">
    <p class="label">Background:</p>
    <p><span class="label">Dominant freq:</span> ${bg.dominant_frequency_hz} Hz &middot;
       <span class="label">Voltage:</span> ${escHtml(bg.voltage)} &middot;
       <span class="label">Continuity:</span> ${escHtml(bg.continuity)}</p>
    <p><span class="label">Symmetry:</span> ${escHtml(bg.symmetry)} &middot;
       <span class="label">Reactivity:</span> ${escHtml(bg.reactivity)}</p>
    ${data.image_quality.montage ? `<p><span class="label">Montage:</span> ${escHtml(data.image_quality.montage)}</p>` : ''}
  `;
}

// --------------- HELPERS ---------------
function escHtml(str) {
  if (str == null) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

function categoryBadgeClass(cat) {
  switch (cat) {
    case 'ESz': case 'ESE': return 'badge-red';
    case 'IIC': return 'badge-amber';
    case 'RPP': return 'badge-blue';
    case 'None': return 'badge-green';
    default: return 'badge-gray';
  }
}

function applyCategoryClass(card, cat) {
  card.classList.remove('cat-esz', 'cat-ese', 'cat-iic', 'cat-rpp', 'cat-none');
  if (cat) card.classList.add('cat-' + cat);
}

function probBar(label, value) {
  const v = Math.max(0, Math.min(100, value || 0));
  const color = v >= 70 ? 'var(--green)' : v >= 40 ? 'var(--amber)' : 'var(--red)';
  return `
    <div class="prob-bar-container">
      <span class="label" style="min-width:auto;font-size:0.8rem">${escHtml(label)}</span>
      <div class="prob-bar">
        <div class="prob-bar-fill" style="width:${v}%;background:${color}"></div>
      </div>
      <span class="prob-bar-label">${v}%</span>
    </div>
  `;
}

// --------------- PRINT ---------------
printBtn.addEventListener('click', () => {
  document.title = 'EEG_Report_' + new Date().toISOString().slice(0, 10);
  window.print();
});

// --------------- INIT ---------------
loadSavedKey();
