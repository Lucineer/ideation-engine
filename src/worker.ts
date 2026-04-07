interface Env { IDEATE_KV: KVNamespace; DEEPSEEK_API_KEY?: string; SILICONFLOW_API_KEY?: string; DEEPINFRA_API_KEY?: string; }

const CSP: Record<string, string> = { 'default-src': "'self'", 'script-src': "'self' 'unsafe-inline' 'unsafe-eval'", 'style-src': "'self' 'unsafe-inline'", 'img-src': "'self' data: https:", 'connect-src': "'self' https://api.deepseek.com https://api.siliconflow.com https://api.deepinfra.com https://*" };

function json(data: unknown, s = 200) { return new Response(JSON.stringify(data), { status: s, headers: { 'Content-Type': 'application/json', ...CSP } }); }

async function callModel(key: string, endpoint: string, model: string, system: string, user: string, max = 1000, temp = 0.7): Promise<string> {
  const resp = await fetch(`${endpoint}/v1/chat/completions`, {
    method: 'POST', headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: max, temperature: temp })
  });
  return (await resp.json()).choices?.[0]?.message?.content || '';
}

function stripFences(t: string): string {
  t = t.trim();
  while (t.startsWith('```')) { t = t.split('\n').slice(1).join('\n'); }
  while (t.endsWith('```')) { t = t.slice(0, -3).trim(); }
  return t;
}

interface Idea { id: string; prompt: string; phase: string; model: string; output: string; score?: number; ts: string; }

// Model routing based on what we've learned:
// Seed-2.0-pro (DeepInfra) = best creative/ideation, dense, no padding
// Seed-2.0-mini (DeepInfra) = cheap creative, great for riffing
// DeepSeek-Reasoner = grounding, feasibility check, second opinion
// DeepSeek-chat = simulation, what-if, practical refinement
// Seed-OSS-36B (SiliconFlow) = creative brainstorming, fast

const ROUTES = {
  dream: { model: 'bytedance/Seed-2.0-pro', endpoint: 'https://api.deepinfra.com', key: 'DEEPINFRA_API_KEY', max: 1500, temp: 0.8, desc: 'Pure creative explosion — no constraints' },
  riff: { model: 'bytedance/seed-2.0-mini', endpoint: 'https://api.deepinfra.com', key: 'DEEPINFRA_API_KEY', max: 800, temp: 0.9, desc: 'Fast cheap riffing — 8 variations at once' },
  ground: { model: 'deepseek-reasoner', endpoint: 'https://api.deepseek.com', key: 'DEEPSEEK_API_KEY', max: 800, temp: 0.3, desc: 'Feasibility check — what is actually possible' },
  refine: { model: 'deepseek-chat', endpoint: 'https://api.deepseek.com', key: 'DEEPSEEK_API_KEY', max: 800, temp: 0.4, desc: 'Practical refinement — make it buildable' },
  brainstorm: { model: 'ByteDance-Seed/Seed-OSS-36B-Instruct', endpoint: 'https://api.siliconflow.com', key: 'SILICONFLOW_API_KEY', max: 600, temp: 0.75, desc: 'Brainstorming — lateral connections' },
};

function getLanding(): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ideation Engine — Cocapn</title><style>
body{font-family:system-ui,sans-serif;background:#0a0a0f;color:#e0e0e0;margin:0;min-height:100vh}
.container{max-width:860px;margin:0 auto;padding:40px 20px}
h1{color:#f59e0b;font-size:2.2em}a{color:#f59e0b;text-decoration:none}
.sub{color:#8A93B4;margin-bottom:2em}
.card{background:#16161e;border:1px solid #2a2a3a;border-radius:12px;padding:24px;margin:20px 0}
.card h3{color:#f59e0b;margin:0 0 12px 0}
.btn{color:#0a0a0f;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-weight:bold;font-size:.9em}
.btn:hover{filter:brightness(1.15)}
.btn-dream{background:#a855f7}.btn-riff{background:#06b6d4}.btn-ground{background:#22c55e}
.btn-refine{background:#f59e0b}.btn-brainstorm{background:#ec4899}
.btn-pipeline{background:#ef4444;font-size:1em;padding:14px 28px}
textarea{width:100%;background:#0a0a0f;color:#e0e0e0;border:1px solid #2a2a3a;border-radius:8px;padding:12px;box-sizing:border-box;font-family:inherit;font-size:.95em;line-height:1.5}
.model-tag{display:inline-block;padding:2px 8px;border-radius:4px;font-size:.7em;font-weight:bold;margin-left:6px}
.tag-dream{background:#a855f733;color:#a855f7}.tag-riff{background:#06b6d433;color:#06b6d4}
.tag-ground{background:#22c55e33;color:#22c55e}.tag-refine{background:#f59e0b33;color:#f59e0b}
.tag-brainstorm{background:#ec489933;color:#ec4899}.tag-pipeline{background:#ef444433;color:#ef4444}
.phase{display:flex;align-items:center;gap:8px;margin:6px 0;padding:12px;background:#1a1a2a;border-radius:8px}
.phase .step{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:.8em;flex-shrink:0}
.phase .content{flex:1;font-size:.9em;line-height:1.5;white-space:pre-wrap}
.pipeline-flow{display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin:16px 0;font-size:.8em}
.pipeline-flow .node{padding:4px 10px;border-radius:6px;font-weight:bold}
.pipeline-flow .arrow{color:#475569}
.idea{padding:16px;background:#1a1a2a;border-left:3px solid #f59e0b;margin:8px 0;border-radius:0 8px 8px 0}
.idea .meta{color:#8A93B4;font-size:.8em;margin-top:8px}
.loading{color:#f59e0b;font-style:italic}
.controls{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}
</style></head><body><div class="container">
<h1>💡 Ideation Engine</h1><p class="sub">Multi-model creative pipeline — dream it, riff it, ground it, build it.</p>

<div class="pipeline-flow">
<span class="node" style="background:#a855f733;color:#a855f7">Dream</span><span class="arrow">→</span>
<span class="node" style="background:#06b6d433;color:#06b6d4">Riff ×8</span><span class="arrow">→</span>
<span class="node" style="background:#ec489933;color:#ec4899">Brainstorm</span><span class="arrow">→</span>
<span class="node" style="background:#22c55e33;color:#22c55e">Ground</span><span class="arrow">→</span>
<span class="node" style="background:#f59e0b33;color:#f59e0b">Refine</span><span class="arrow">→</span>
<span class="node" style="background:#ef444433;color:#ef4444">Build Plan</span>
</div>

<div class="card"><h3>What are you thinking about?</h3>
<textarea id="prompt" rows="3" placeholder="A problem to solve, a product to build, a concept to explore, a wild idea..."></textarea>
<div class="controls">
<button class="btn btn-pipeline" onclick="fullPipeline()">⚡ Full Pipeline (5 models)</button>
</div>
<div class="controls">
<button class="btn btn-dream" onclick="singlePhase('dream')">✨ Dream</button>
<button class="btn btn-riff" onclick="singlePhase('riff')">🔄 Riff ×8</button>
<button class="btn btn-brainstorm" onclick="singlePhase('brainstorm')">🧠 Brainstorm</button>
<button class="btn btn-ground" onclick="singlePhase('ground')">✅ Ground</button>
<button class="btn btn-refine" onclick="singlePhase('refine')">🔧 Refine</button>
</div></div>

<div id="output" class="card" style="display:none"><h3>Pipeline Output</h3><div id="result"></div></div>
<div id="history" class="card"><h3>Recent Ideas</h3><p style="color:#8A93B4">Loading...</p></div>

<script>
async function singlePhase(phase){const p=document.getElementById('prompt').value.trim();if(!p)return;
const out=document.getElementById('output');out.style.display='block';
document.getElementById('result').innerHTML='<div class="loading">Calling '+phase+' model...</div>';
const r=await fetch('/api/ideate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:p,phase})});
const data=await r.json();
document.getElementById('result').innerHTML='<div class="phase"><div class="step" style="background:'+getPhaseColor(phase)+';color:#0a0a0f">'+phase[0].toUpperCase()+'</div><div class="content"><span class="model-tag tag-'+phase+'">'+data.model+'</span><br>'+data.output.replace(/\\n/g,'<br>')+'</div></div>'+loadHistory();}
async function fullPipeline(){const p=document.getElementById('prompt').value.trim();if(!p)return;
const out=document.getElementById('output');out.style.display='block';
document.getElementById('result').innerHTML='<div class="loading">Running full 5-model pipeline... (~30s)</div>';
const r=await fetch('/api/pipeline',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:p})});
const data=await r.json();
if(data.error){document.getElementById('result').innerHTML='<div style="color:#ef4444">'+data.error+'</div>';return;}
let html='';
const phases=['dream','riff','brainstorm','ground','refine'];
const colors={'dream':'#a855f7','riff':'#06b6d4','brainstorm':'#ec4899','ground':'#22c55e','refine':'#f59e0b'};
const labels={'dream':'Dream (Seed-2.0-pro)','riff':'Riff x8 (Seed-2.0-mini)','brainstorm':'Brainstorm (Seed-OSS-36B)','ground':'Ground (DeepSeek-Reasoner)','refine':'Refine (DeepSeek-chat)'};
phases.forEach((ph,i)=>{if(data[ph]){html+='<div class="phase"><div class="step" style="background:'+colors[ph]+';color:#0a0a0f">'+(i+1)+'</div><div class="content"><span class="model-tag tag-'+ph+'">'+labels[ph]+'</span><br>'+data[ph].replace(/\\n/g,'<br>')+'</div></div>';}});
if(data.summary)html+='<div style="padding:16px;background:#0a1a0a;border:2px solid #22c55e;border-radius:8px;margin-top:12px"><strong style="color:#22c55e">Build-Ready Summary</strong><br>'+data.summary.replace(/\\n/g,'<br>')+'</div>';
document.getElementById('result').innerHTML=html;loadHistory();}
function getPhaseColor(p){return{dream:'#a855f7',riff:'#06b6d4',brainstorm:'#ec4899',ground:'#22c55e',refine:'#f59e0b'}[p]||'#f59e0b';}
async function loadHistory(){try{const r=await fetch('/api/ideas');const ideas=await r.json();
const el=document.getElementById('history');
if(!ideas.length)el.innerHTML='<h3>Recent Ideas</h3><p style="color:#8A93B4">No ideas yet. Try the pipeline.</p>';
else el.innerHTML='<h3>Recent Ideas ('+ideas.length+')</h3>'+ideas.slice(0,10).map(x=>'<div class="idea">'+x.prompt.substring(0,80)+'<span class="model-tag tag-'+(x.phase||'dream')+'">'+(x.model||x.phase)+'</span><div class="meta">'+x.phase+' · '+new Date(x.ts).toLocaleString()+'</div></div>').join('');}catch(e){}}
loadHistory();</script>
<div style="text-align:center;padding:24px;color:#475569;font-size:.75rem"><a href="https://the-fleet.casey-digennaro.workers.dev" style="color:#64748b">The Fleet</a> · <a href="https://cocapn.ai" style="color:#64748b">Cocapn</a></div>
</div></body></html>`;
}

function getApiKey(env: Env, name: string): string | undefined {
  const mapping: Record<string, string> = { DEEPINFRA_API_KEY: env.DEEPINFRA_API_KEY, DEEPSEEK_API_KEY: env.DEEPSEEK_API_KEY, SILICONFLOW_API_KEY: env.SILICONFLOW_API_KEY };
  return mapping[name];
}

async function ideate(env: Env, phase: string, prompt: string, context = ''): Promise<{ output: string; model: string }> {
  const route = ROUTES[phase as keyof typeof ROUTES];
  if (!route) return { output: 'Unknown phase', model: 'none' };
  const key = getApiKey(env, route.key);
  if (!key) return { output: `No API key configured for ${route.key}`, model: route.model };

  const systems: Record<string, string> = {
    dream: 'You are a wild creative thinker. Go beyond obvious ideas. Be specific, not vague. Give concrete examples. Think about what would actually work in the real world, not just what sounds cool. Output 3-5 bold ideas, each with a name and 2-3 sentences.',
    riff: 'You are a fast creative variator. Take the input idea and produce 8 distinct variations. Each variation should be meaningfully different — not just word swaps. Be concrete. Number them 1-8.',
    brainstorm: 'You are a lateral thinker. Find unexpected connections between the input ideas and completely unrelated domains. What patterns emerge? What would a chef, an architect, a biologist, and a game designer each see in this? Be specific.',
    ground: 'You are a practical engineer. For each idea, assess: 1) What is technically feasible TODAY? 2) What is the simplest MVP? 3) What would take 3 months vs 3 years? 4) What is the biggest risk? Be honest — kill bad ideas, strengthen good ones.',
    refine: 'You are a product builder. Take the surviving ideas and produce a concrete build plan: 1) What to build first (this week) 2) What to validate 3) What the user sees 4) 3 concrete next steps. Be practical, not aspirational.'
  };

  const fullPrompt = context ? `Context from previous phases:\n${context}\n\nNow: ${prompt}` : prompt;
  const output = await callModel(key, route.endpoint, route.model, systems[phase] || '', fullPrompt, route.max, route.temp);
  return { output: stripFences(output), model: route.model };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/health') return json({ status: 'ok', vessel: 'ideation-engine' });
    if (url.pathname === '/vessel.json') return json({ name: 'ideation-engine', type: 'cocapn-vessel', version: '1.0.0', description: 'Multi-model creative pipeline — dream, riff, brainstorm, ground, refine', fleet: 'https://the-fleet.casey-digennaro.workers.dev', capabilities: ['multi-model-ideation', 'creative-pipeline', 'model-routing'] });

    if (url.pathname === '/api/ideas') return json((await env.IDEATE_KV.get('ideas', 'json') as Idea[] || []).slice(0, 20));

    if (url.pathname === '/api/ideate' && req.method === 'POST') {
      const { prompt, phase } = await req.json() as { prompt: string; phase: string };
      if (!prompt || !phase) return json({ error: 'prompt and phase required' }, 400);
      const result = await ideate(env, phase, prompt);
      const ideas = await env.IDEATE_KV.get('ideas', 'json') as Idea[] || [];
      ideas.unshift({ id: Date.now().toString(), prompt, phase, model: result.model, output: result.output.substring(0, 3000), ts: new Date().toISOString() });
      if (ideas.length > 50) ideas.length = 50;
      await env.IDEATE_KV.put('ideas', JSON.stringify(ideas));
      return json(result);
    }

    if (url.pathname === '/api/pipeline' && req.method === 'POST') {
      const { prompt } = await req.json() as { prompt: string };
      if (!prompt) return json({ error: 'prompt required' }, 400);

      // Phase 1: Dream (Seed-2.0-pro)
      const dream = await ideate(env, 'dream', prompt);
      // Phase 2: Riff on the dream (Seed-2.0-mini)
      const riff = await ideate(env, 'riff', prompt, dream.output);
      // Phase 3: Brainstorm lateral connections (Seed-OSS-36B)
      const brainstorm = await ideate(env, 'brainstorm', prompt, `${dream.output}\n\nVariations:\n${riff.output}`);
      // Phase 4: Ground check (DeepSeek-Reasoner)
      const ground = await ideate(env, 'ground', prompt, `Ideas:\n${dream.output}\n\nRiffs:\n${riff.output}\n\nConnections:\n${brainstorm.output}`);
      // Phase 5: Refine into build plan (DeepSeek-chat)
      const refine = await ideate(env, 'refine', prompt, `Ideas:\n${dream.output}\n\nFeasibility:\n${ground.output}`);

      // Save all phases
      const ideas = await env.IDEATE_KV.get('ideas', 'json') as Idea[] || [];
      const ts = new Date().toISOString();
      for (const [phase, result] of [['dream', dream], ['riff', riff], ['brainstorm', brainstorm], ['ground', ground], ['refine', refine]] as [string, { model: string; output: string }][]) {
        ideas.unshift({ id: Date.now().toString() + phase[0], prompt, phase, model: result.model, output: result.output.substring(0, 3000), ts });
      }
      if (ideas.length > 50) ideas.length = 50;
      await env.IDEATE_KV.put('ideas', JSON.stringify(ideas));

      return json({
        dream: dream.output, riff: riff.output, brainstorm: brainstorm.output,
        ground: ground.output, refine: refine.output,
        summary: refine.output.substring(0, 500)
      });
    }

    return new Response(getLanding(), { headers: { 'Content-Type': 'text/html;charset=UTF-8', ...CSP } });
  }
};
