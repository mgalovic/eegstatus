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

## STEP 0 (BEFORE ANYTHING ELSE): Is a rhythmic or periodic pattern actually present?

NOT every repetitive or slow activity qualifies as an ACNS rhythmic/periodic pattern. You MUST apply these gatekeeping criteria FIRST, before attempting any Term 1/Term 2 classification:

**A pattern qualifies as rhythmic or periodic ONLY if ALL of the following are met:**
1. There are at least **6 relatively regular cycles or repeats** visible in the recording. Fewer than 6 cycles = not enough to establish periodicity or rhythmicity.
2. The pattern is in the **delta range (≤4 Hz)** for RDA, or any frequency for PDs/SW. Activities in the theta (4–8 Hz), alpha (8–13 Hz), or beta (>13 Hz) range are NORMAL RHYTHMS, not ACNS patterns.
3. The pattern is **abnormal**. The following are NEVER classified as ACNS rhythmic/periodic patterns:
   - **Alpha rhythm** (8–13 Hz posterior dominant rhythm) — this is a normal finding
   - **Sleep spindles, vertex waves, K-complexes** — normal sleep architecture
   - **Mu rhythm** — normal central rhythm
   - **Beta activity** — normal or medication-related
   - **Posterior dominant rhythm of any frequency** — even if slow, this is background, not a pattern
4. The activity must show **regularity** — relatively consistent inter-discharge intervals (for PDs) or relatively consistent cycle duration (for RDA). Polymorphic activity does NOT qualify:
   - **Generalized polymorphic slowing** = irregular, variable slow waves without consistent frequency or morphology → NOT GRDA
   - **Regional/focal polymorphic slowing** = irregular slow waves over one region → NOT LRDA
   - The key distinction: RDA has a **quasi-sinusoidal, monomorphic** appearance with consistent cycle-to-cycle morphology. Polymorphic slowing has **variable morphology** from wave to wave.

**If the pattern fails any of these criteria, set pattern.present = false and classify as "None."**
You MUST state in your reasoning: "Pattern qualification check: [pass/fail]" with justification.

## CRITICAL: Distinguishing RDA from PDs

This distinction is the single most important classification step. Apply these criteria carefully:

**Rhythmic Delta Activity (RDA):**
- Waveforms are sinusoidal or quasi-sinusoidal with smooth, rounded morphology
- There is NO clear inter-discharge interval — each wave flows directly into the next
- The waveform occupies most or all of each cycle (high duty cycle, typically >50%)
- Consecutive waves have relatively uniform duration, amplitude, and shape
- Think of it as a continuous oscillation, like a sine wave in the delta range

**Periodic Discharges (PDs):**
- Discrete, distinct waveforms separated by a clear inter-discharge interval
- Each discharge is a brief, identifiable event with a return to baseline between discharges
- The waveform occupies only a fraction of each cycle (low duty cycle, typically <50%)
- The inter-discharge interval (baseline between discharges) is clearly visible
- Think of it as repeated distinct events with pauses between them

**Decision rule:** Look at the space between consecutive waveforms. If there is a clear return to baseline between waveforms (an inter-discharge interval), classify as PDs. If the activity is a continuous oscillation without clear inter-discharge intervals, classify as RDA.

**Common pitfall:** High-amplitude slow waves that repeat regularly can look periodic but are actually rhythmic if they are sinusoidal and lack a true inter-discharge interval. GRDA in particular is frequently misclassified as GPD — always check for the inter-discharge interval before classifying as periodic.

## Modifiers

**Prevalence:**
- Continuous: ≥90% of epoch
- Abundant: 50–89%
- Frequent: 10–49%
- Occasional: 1–9%
- Rare: <1%

**Frequency — systematic measurement method (CRITICAL):**
You MUST measure frequency using this procedure:
1. Locate the vertical gridlines in the EEG — these mark 1-second intervals.
2. Count the total number of 1-second intervals visible in the epoch (= total seconds visible).
3. Count the total number of discharges or cycles of the pattern visible in the epoch.
4. Calculate: frequency = (number of discharges or cycles) / (number of seconds visible).
5. Report this value in Hz.
You MUST state in your reasoning: "Frequency measurement: [X] discharges/cycles in [Y] seconds = [Z] Hz."
Do NOT estimate frequency by visual impression alone — always count explicitly.

**Plus modifiers** (significantly increase seizure risk):
- +F = superimposed Fast activity (clearly distinct fast activity riding ON TOP of the underlying pattern)
- +R = superimposed Rhythmic activity (a separate rhythmic component distinct from the base pattern)
- +S = superimposed Sharp waves or spikes (see strict criteria below)
- +FR, +FS = combinations

**STRICT criteria for +S modifier:**
The +S modifier requires CLEARLY IDENTIFIABLE sharp transients that are DISTINCT FROM and SUPERIMPOSED ON the underlying pattern. Specifically:
- There must be a sharp wave or spike component (duration <200ms for sharp wave, <70ms for spike) that is visually separable from the base waveform.
- The sharp component must stand out from the overall morphology of the pattern — it is NOT enough for the pattern itself to have somewhat pointed or angular peaks.
- For RDA specifically: if the delta waves simply have angular or pointed peaks rather than perfectly smooth sinusoidal peaks, this is NOT +S. This is just the normal morphological variation of RDA. +S for RDA requires a distinct sharp transient riding on top of the delta wave.
- For PDs: the discharge itself may be sharp — that is intrinsic to PDs and does NOT warrant a +S modifier. +S for PDs requires ADDITIONAL sharp transients between or on top of the periodic discharges.
- When in doubt, do NOT assign +S. It is better to omit a questionable +S modifier than to over-assign it, as it significantly changes the clinical category and management implications.

**Evolution vs. Fluctuation (critical for seizure classification):**

- **Evolution** = definite, progressive, sequential change in at least ONE of: (1) frequency (e.g., speeding up or slowing down), (2) morphology (e.g., sharpening), or (3) location/field (e.g., spreading from focal to hemispheric). The change must occur over ≥10 seconds and must be UNIDIRECTIONAL within a single epoch — not random variation.
- **Fluctuation** = non-progressive, irregular changes in frequency, morphology, or amplitude that do NOT follow a consistent direction. Fluctuation is NOT evolution. Fluctuating patterns are classified as +F modifier, not as evolving.
- **Static** = no meaningful change in frequency, morphology, or location over time.

When assessing for evolution, specifically look for:
- Gradual increase in frequency (e.g., 1 Hz → 2 Hz → 3 Hz over 10+ seconds)
- Progressive change in morphology (e.g., blunt → sharply contoured → spike-like)
- Spatial spread (e.g., focal → regional → hemispheric)
- Sequential involvement of these features

## Clinical Category Thresholds (apply strictly, in this exact order)

1. **ESz (Electrographic Seizure):** REQUIRES one of these two criteria with CLEAR evidence:
   - Frequency >2.5 Hz sustained for ≥10 seconds; OR
   - Definite evolution (progressive, unidirectional change in frequency, morphology, or spatial distribution) over ≥10 seconds.
   - Mere fluctuation is NOT evolution. A pattern that varies irregularly does NOT qualify as ESz.
   - You MUST have clear visual evidence of one of these criteria to classify as ESz.

2. **ESE (Electrographic Status Epilepticus):** REQUIRES that ESz criteria (above) are FIRST met, AND THEN:
   - The ESz is continuous for >10 minutes; OR
   - The ESz occupies >20% of any 60-minute epoch.
   - A continuous pattern that does NOT independently meet ESz criteria (i.e., ≤2.5 Hz without evolution) can NEVER be classified as ESE, regardless of how long it persists.

3. **IIC (Ictal-Interictal Continuum):** ONLY the following specific patterns qualify:
   - LPD, GPD, BIPD, or SW (lateralized or generalized) at 1.0–2.5 Hz; OR
   - LPD, GPD, BIPD, or SW at 0.5–1.0 Hz WITH any Plus modifier (+F, +R, +S); OR
   - **LRDA** (lateralized RDA only) at >1 Hz WITH any Plus modifier.
   - **GRDA NEVER qualifies as IIC.** Generalized RDA (GRDA), with or without any Plus modifier, at any frequency, does NOT meet IIC criteria. GRDA is always classified as RPP or None.
   - RDA only qualifies for IIC if it is LATERALIZED (LRDA), AND >1 Hz, AND has a Plus modifier.

4. **RPP (Rhythmic/Periodic Pattern):** A rhythmic or periodic pattern is present (including GRDA) but does not meet any of the above IIC, ESz, or ESE thresholds.

5. **None:** No rhythmic or periodic patterns identified (pattern.present = false).

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

Follow these steps in EXACT order. Your REASONING section MUST address EACH step explicitly with the required statements.

1. **Image quality:** Assess interpretability. If not an EEG or completely uninterpretable, set image_quality.interpretable to false.

2. **Background:** Describe dominant frequency, voltage, continuity, symmetry, and reactivity. Identify any normal rhythms (alpha, beta, sleep architecture) — these will be excluded in step 3.

3. **Pattern qualification gate (CRITICAL — do this BEFORE any classification):**
   - Is there any repetitive activity that could be a rhythmic or periodic pattern?
   - Exclude normal rhythms: alpha rhythm, beta activity, sleep spindles, mu rhythm, posterior dominant rhythm.
   - Exclude polymorphic slowing: if the slow activity has variable morphology wave-to-wave, it is polymorphic delta/theta, NOT RDA.
   - Count the cycles/repeats: are there at least 6 relatively regular cycles? If not → no pattern.
   - Is the activity in the delta range (for RDA) or does it have clear periodic discharges?
   - You MUST state: "Pattern qualification check: [pass/fail] — [reason]"
   - If FAIL → set pattern.present = false, category = "None", and skip to step 8.

4. **Frequency measurement (CRITICAL — count, do not estimate):**
   - Locate the vertical 1-second gridlines in the EEG.
   - Count the number of 1-second intervals visible in the epoch.
   - Count the number of discharges or complete cycles of the pattern.
   - Calculate: frequency = discharges or cycles / seconds.
   - You MUST state: "Frequency measurement: [X] discharges/cycles in [Y] seconds = [Z] Hz"

5. **Lateralization assessment (Term 1):**
   - Identify the channels showing maximum amplitude of the pattern.
   - Compare amplitude of the pattern in homologous channels across hemispheres.
   - If there is ≥30% amplitude difference between hemispheres → classify as Lateralized (L).
   - If the pattern is present independently in both hemispheres with separate generators → classify as Bilateral Independent (BI).
   - If the pattern is symmetric or near-symmetric across hemispheres → classify as Generalized (G).
   - You MUST state: "Lateralization: [assessment] — amplitude comparison: [description]"

6. **Pattern type (Term 2) — RDA vs PDs (CRITICAL):**
   - Examine the inter-discharge interval: is there a clear return to baseline between waveforms?
   - If YES (clear inter-discharge interval, low duty cycle) → PDs.
   - If NO (continuous sinusoidal oscillation, no return to baseline) → RDA.
   - You MUST state: "Inter-discharge interval: [present/absent]"

7. **Plus modifier assessment — be STRICT, especially for +S:**
   - Only assign +S if there are clearly distinct sharp transients superimposed on the pattern (see +S criteria above).
   - Angular or pointed peaks on RDA waves are NOT sufficient for +S.
   - The intrinsic sharpness of periodic discharges does NOT warrant +S.

8. **Evolution assessment (for ESz/ESE only):**
   - Look for progressive, unidirectional change in frequency, morphology, or location over ≥10 seconds.
   - Fluctuation ≠ evolution.
   - You MUST state: "Evolution: [present/absent] — [description]"

9. **Clinical category:** Apply thresholds strictly in order. Remember: GRDA NEVER qualifies as IIC.

10. **Seizure risk:** Use Rodriguez Ruiz data matched to the correct pattern (RDA vs PD).

11. **Summary:** 2–3 sentences.

**Output format:**
First, write a REASONING section (200–400 words) explaining your analysis step by step. You MUST explicitly address the RDA vs PD distinction and evolution assessment.
Then output a JSON block in a \`\`\`json code fence with EXACTLY this schema.

**term1_probabilities and term2_probabilities:** For each possible value of Term 1 (G, L, BI, UI, Mf, none) and Term 2 (PDs, RDA, SW, none), provide a probability (0–100) representing how likely that term applies to this EEG. The probabilities within each group should sum to approximately 100. "none" represents no rhythmic/periodic pattern being present. These probabilities allow the reader to see your differential and how confident you are in the chosen term versus alternatives.

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
  "term1_probabilities": {
    "G": 0,
    "L": 0,
    "BI": 0,
    "UI": 0,
    "Mf": 0,
    "none": 0
  },
  "term2_probabilities": {
    "PDs": 0,
    "RDA": 0,
    "SW": 0,
    "none": 0
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

  renderTermsCard(data);
  renderPatternCard(data);
  renderCategoryCard(data);
  renderRiskCard(data);
  renderSummaryCard(data);

  reportSection.hidden = false;
  reportSection.scrollIntoView({ behavior: 'smooth' });
}

function renderTermsCard(data) {
  const termsCard = document.getElementById('terms-card');
  const term1Container = document.getElementById('term1-bars');
  const term2Container = document.getElementById('term2-bars');

  const t1 = data.term1_probabilities || {};
  const t2 = data.term2_probabilities || {};
  const selectedT1 = data.pattern ? data.pattern.main_term_1 : 'none';
  const selectedT2 = data.pattern ? data.pattern.main_term_2 : 'none';

  const term1Labels = { G: 'G', L: 'L', BI: 'BI', UI: 'UI', Mf: 'Mf', none: 'None' };
  const term1Full = { G: 'Generalized', L: 'Lateralized', BI: 'Bilateral Indep.', UI: 'Unilateral Indep.', Mf: 'Multifocal', none: 'No pattern' };
  const term2Labels = { PDs: 'PDs', RDA: 'RDA', SW: 'SW', none: 'None' };
  const term2Full = { PDs: 'Periodic Discharges', RDA: 'Rhythmic Delta Activity', SW: 'Spike-and-Wave', none: 'No pattern' };

  term1Container.innerHTML = renderTermBars(t1, term1Labels, term1Full, selectedT1);
  term2Container.innerHTML = renderTermBars(t2, term2Labels, term2Full, selectedT2);

  // Apply category color to the terms card
  if (data.clinical_category) {
    const cat = data.clinical_category.category.toLowerCase().replace(/\s/g, '');
    applyCategoryClass(termsCard, cat);
  }
}

function renderTermBars(probs, labels, fullNames, selected) {
  const keys = Object.keys(labels);
  // Sort by probability descending
  keys.sort((a, b) => (probs[b] || 0) - (probs[a] || 0));

  return keys.map(key => {
    const v = Math.max(0, Math.min(100, probs[key] || 0));
    const isSelected = key === selected;
    const barColor = isSelected ? 'var(--accent)' : 'var(--text-muted)';
    const labelColor = isSelected ? 'color: var(--text)' : '';
    const title = fullNames[key] || key;
    return `
      <div class="term-bar-row" title="${escHtml(title)}">
        <span class="term-bar-label" style="${labelColor}">${escHtml(labels[key])}</span>
        <div class="term-bar-track">
          <div class="term-bar-fill ${isSelected ? 'selected' : ''}" style="width:${v}%;background:${barColor}"></div>
        </div>
        <span class="term-bar-value">${v}%</span>
      </div>
    `;
  }).join('');
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
