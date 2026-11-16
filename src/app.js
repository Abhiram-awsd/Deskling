/* Deskling app logic: focus timer, tasks, reminders, stats, and the panel UI.
   No framework, no build step. State lives in localStorage on your own machine. */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MIN = 60000, DAY = 86400000, now = () => Date.now();
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const pad = (n) => String(n).padStart(2, '0');
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const uid = () => now().toString(36) + Math.random().toString(36).slice(2, 5);
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const REPO = 'Abhiram-awsd/Deskling';

  const NUDGES = {
    water: { label: 'Drink water', text: 'Water break. Take a few sips.', yes: 'Drank it', stat: 'water', every: 45, on: true },
    move: { label: 'Stand up and stretch', text: 'You have been sitting a while. Stand up and stretch for a minute.', yes: 'Stretched', stat: 'moves', every: 60, on: true },
    eyes: { label: 'Rest your eyes', text: 'Eye break. Look at something far away for 20 seconds.', yes: 'Done', stat: 'eyes', every: 20, on: true },
    posture: { label: 'Check posture', text: 'Posture check. Shoulders down, back straight.', yes: 'Fixed it', stat: null, every: 30, on: false },
  };
  const SIZES = { s: 52, m: 72, l: 96 };
  const CHEERS = ['Done. Next.', 'One down.', 'Clean work.', 'That is how it is done.', 'Knocked out.'];
  const VOICE = {
    bolt: ['Beep boop.', 'Systems green.'], nova: ['Houston, we are focused.', 'Zero gravity, zero excuses.'],
    miso: ['Purr.', 'Mrrp?'], biscuit: ['Woof!', 'Throw the ball. Then do the task.'], max: ['Bear hug.', 'You are doing fine. Keep going.'],
  };
  const TRICK = { bolt: 'flip', nova: 'spin', miso: 'stretch', biscuit: 'chase', max: 'hug' };
  const PATS = ['Locked in?', 'Pick one task and start the timer.', 'Small steps still count.', 'You have got this.', 'What is the next move?'];

  // ---- state
  const KEY = 'deskling.v1';
  const S = Object.assign({
    char: 'bolt', look: 'soft', size: 'm', mode: 'sit', sound: true, goal: 4, autoUpd: true,
    pomo: { focus: 25, short: 5, long: 15, every: 4 },
    nudges: Object.fromEntries(Object.entries(NUDGES).map(([k, n]) => [k, { on: n.on, every: n.every }])),
    todos: [], rems: [], days: {}, best: 0, next: {}, dnd: 0, greeted: '', recapped: '', weekly: '', updAt: 0, updSeen: '',
    timer: { phase: 'idle', endsAt: 0, left: 0, paused: false, count: 0, task: '' },
  }, (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })());
  for (const k in NUDGES) S.nudges[k] = S.nudges[k] || { on: NUDGES[k].on, every: NUDGES[k].every };

  let saveT = 0;
  const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} }, 250); };
  const today = () => (S.days[dayKey()] = S.days[dayKey()] || { focus: 0, pomos: 0, tasks: 0, water: 0, moves: 0, eyes: 0, intent: '' });
  function streak() {
    let n = 0; const d = new Date();
    if (!(S.days[dayKey(d)] || {}).pomos) d.setDate(d.getDate() - 1);
    while ((S.days[dayKey(d)] || {}).pomos > 0) { n++; d.setDate(d.getDate() - 1); }
    if (n > S.best) S.best = n;
    return n;
  }

  // ---- startup housekeeping (history older than a year is dropped)
  (function tidy() {
    const cut = new Date(); cut.setDate(cut.getDate() - 365); const ck = dayKey(cut);
    for (const k of Object.keys(S.days)) if (k < ck) delete S.days[k];
    const t = S.timer;
    if (t.phase !== 'idle' && !t.paused && t.endsAt < now()) Object.assign(t, { phase: 'idle', endsAt: 0, left: 0 });
    for (const k in NUDGES) if (!S.next[k] || S.next[k] < now()) S.next[k] = now() + S.nudges[k].every * MIN;
  })();

  // ---- view state
  const soon = new Date(now() + 60 * MIN);
  const ui = {
    panel: false, tab: 'focus', bubble: null, quick: false, queue: [], flash: null, flashUntil: 0, stageKey: '', shown: '',
    draft: {}, err: '', version: null, upd: null,
    cal: { open: false, y: soon.getFullYear(), m: soon.getMonth(), sel: dayKey(soon), time: `${pad(soon.getHours())}:00`, repeat: 'once' },
  };
  const pet = $('#pet'), above = $('#above'), pill = $('#pill');
  const fig = Buddy.mount($('#fig'), { char: S.char, look: S.look });

  function baseExpr() {
    const t = S.timer, h = new Date().getHours();
    if (t.phase === 'focus' && !t.paused) return 'focus';
    if (t.phase !== 'idle' && !t.paused) return 'happy';
    return h >= 23 || h < 5 ? 'sleep' : 'idle';
  }

  // ---- motion: body moves, eye direction and little particles
  const figEl = $('#fig'), calm = matchMedia('(prefers-reduced-motion: reduce)');
  let animT = 0;
  function anim(name, ms) {
    for (const c of [...figEl.classList]) if (c.startsWith('a-')) figEl.classList.remove(c);
    void figEl.offsetWidth; figEl.classList.add('a-' + name);
    clearTimeout(animT); if (ms) animT = setTimeout(() => figEl.classList.remove('a-' + name), ms);
  }
  function look(x, y) { figEl.style.setProperty('--lx', x); figEl.style.setProperty('--ly', y); }
  const CONFETTI = ['#ffd23f', '#3df0ff', '#ff5d73', '#7dff8a', '#b79bff'];
  function burst(kind, n) {
    if (calm.matches) return;
    const px = SIZES[S.size];
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i'); p.className = 'p p-' + kind;
      if (kind === 'star') p.textContent = '✦'; else if (kind === 'z') p.textContent = 'z'; else if (kind === 'heart') p.textContent = '♥';
      p.style.setProperty('--dx', ((Math.random() * 2 - 1) * px * 0.5).toFixed(0) + 'px');
      p.style.setProperty('--dy', (-(8 + Math.random() * 20)).toFixed(0) + 'px');
      p.style.setProperty('--r', ((Math.random() * 2 - 1) * 200).toFixed(0) + 'deg');
      p.style.setProperty('--d', (i * 0.04).toFixed(2) + 's');
      p.style.setProperty('--c', kind === 'confetti' ? CONFETTI[i % CONFETTI.length] : kind === 'star' ? Buddy.byId(S.char).glow : kind === 'heart' ? '#ff5d73' : '');
      pet.appendChild(p); setTimeout(() => p.remove(), 2600);
    }
  }
  function ring() { pet.classList.remove('ring'); void pet.offsetWidth; pet.classList.add('ring'); setTimeout(() => pet.classList.remove('ring'), 800); }

  function face() { pet.style.setProperty('--glow', Buddy.byId(S.char).glow); fig.set({ char: S.char, look: S.look, expr: now() < ui.flashUntil ? ui.flash : baseExpr() }); }
  function flash(expr, ms = 1800, hop) {
    ui.flash = expr; ui.flashUntil = now() + ms; face(); setTimeout(face, ms + 30);
    if (hop) { pet.classList.remove('hop'); void pet.offsetWidth; pet.classList.add('hop'); setTimeout(() => pet.classList.remove('hop'), 1100); }
  }

  function chime(up = true, times = 1) {
    if (!S.sound) return;
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      for (let n = 0; n < times; n++) (up ? [660, 880] : [520, 392]).forEach((f, i) => {
        const o = ac.createOscillator(), g = ac.createGain(), t0 = ac.currentTime + n * 0.5 + i * 0.14;
        o.type = 'triangle'; o.frequency.value = f; o.connect(g); g.connect(ac.destination);
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
        o.start(t0); o.stop(t0 + 0.34);
      });
      setTimeout(() => ac.close(), 900 + times * 500);
    } catch {}
  }

  // ---- window layout: the window is only ever as big as what is on screen
  function layout() {
    const px = SIZES[S.size]; document.documentElement.style.setProperty('--size', px + 'px');
    const pw = px + 44, ph = px + 58; // room for hops and sparks
    const st = ui.panel ? [340, ph + 416, false] : ui.quick ? [320, ph + 130, false] : ui.bubble ? [300, ph + 170, false] : [Math.max(pw, 96), ph, true];
    const visible = S.mode !== 'hide' || ui.panel || ui.quick || !!ui.bubble;
    const key = st.join() + visible;
    if (key === ui.stageKey) return;
    ui.stageKey = key;
    Shell.stage(st[0], st[1], st[2]);
    visible ? Shell.show() : Shell.hide();
  }

  // ---- speech bubbles
  function say(text, o = {}) { ui.queue.push(Object.assign({ text, ttl: 6000 }, o)); pump(); }
  function pump() {
    if (ui.bubble || ui.panel || ui.quick || !ui.queue.length) return;
    const b = (ui.bubble = ui.queue.shift());
    if (b.expr) flash(b.expr, 2200, b.hop);
    if (b.sound) chime(b.sound === 'up', b.rem ? 2 : 1);
    if (b.buttons && !b.hop) anim('wave', 950);
    b.timer = setTimeout(() => closeBubble(b, true), b.ttl);
    render();
  }
  function closeBubble(b = ui.bubble, timedOut) {
    if (!b || b !== ui.bubble) return;
    clearTimeout(b.timer); ui.bubble = null;
    if (timedOut && b.onMiss) b.onMiss();
    render(); setTimeout(pump, 400);
  }

  // ---- focus timer
  const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; };
  const left = () => { const t = S.timer; return t.phase === 'idle' ? S.pomo.focus * MIN : t.paused ? t.left : t.endsAt - now(); };
  function start(phase) {
    Object.assign(S.timer, { phase, endsAt: now() + S.pomo[phase] * MIN, paused: false, left: 0 });
    if (phase === 'focus') { anim('power', 700); ring(); } else anim('stretch', 900);
    save(); face(); render();
  }
  function pause() { const t = S.timer; if (t.phase === 'idle') return; if (t.paused) { t.endsAt = now() + t.left; t.paused = false; } else { t.left = t.endsAt - now(); t.paused = true; } save(); face(); render(); }
  function stop(gaveUp) {
    const mid = S.timer.phase === 'focus';
    Object.assign(S.timer, { phase: 'idle', endsAt: 0, left: 0, paused: false }); save(); face(); render();
    if (gaveUp === true && mid) flash('sad', 1500);
  }
  function finish() {
    const t = S.timer;
    if (t.phase === 'focus') {
      const d = today(); d.pomos++; d.focus += S.pomo.focus; t.count++;
      const long = t.count % S.pomo.every === 0, n = streak(), goal = d.pomos === S.goal;
      start(long ? 'long' : 'short');
      setTimeout(() => { anim('cheer', 1250); burst('confetti', 12); }, 50);
      say(`Session ${d.pomos} done.${goal ? ` That is your goal of ${S.goal} for today.` : ''} ${long ? 'Take a long' : 'Take a short'} break, ${S.pomo[long ? 'long' : 'short']} minutes.` + (d.pomos === 1 && n > 1 ? ` Streak: ${n} days.` : ''),
        { ttl: 12000, expr: goal ? 'star' : 'happy', hop: true, sound: 'up', buttons: [{ label: 'Skip break', fn: () => stop() }] });
    } else {
      stop();
      say('Break is over. Ready for the next session?', { ttl: 30000, sound: 'down', buttons: [{ label: 'Start focus', go: true, fn: () => start('focus') }, { label: 'Not now' }] });
    }
  }

  // ---- wellbeing nudges: held back during a focus session, delivered at the next break
  function nudges() {
    if (now() < S.dnd || (S.timer.phase === 'focus' && !S.timer.paused) || ui.bubble || ui.panel || ui.quick || ui.queue.length) return;
    for (const k in NUDGES) {
      const n = NUDGES[k], cfg = S.nudges[k];
      if (!cfg.on || now() < S.next[k]) continue;
      const again = (m) => { S.next[k] = now() + m * MIN; save(); };
      again(cfg.every);
      say(n.text, { ttl: 45000, sound: 'up', onMiss: () => again(cfg.every), buttons: [
        { label: n.yes, go: true, fn: () => { if (n.stat) today()[n.stat]++; flash('happy', 1500); save(); } },
        { label: 'In 10 min', fn: () => again(10) }] });
      return;
    }
  }

  // ---- your own reminders: one-off or repeating, always delivered on time
  const REPEATS = { once: 'Once', daily: 'Every day', weekdays: 'Weekdays' };
  function nextTime(r) {
    const d = new Date(r.base);
    do { d.setDate(d.getDate() + 1); } while (d.getTime() <= now() || (r.repeat === 'weekdays' && (d.getDay() === 0 || d.getDay() === 6)));
    return d.getTime();
  }
  function addReminder(text, at, repeat = 'once') {
    S.rems.push({ id: uid(), text: text.slice(0, 120), base: at, at, repeat, tries: 0 });
    S.rems.sort((a, b) => a.at - b.at); save();
  }
  function settle(r, done) {
    if (r.repeat !== 'once') { r.base = nextTime(r); r.at = r.base; r.tries = 0; r.missed = false; }
    else if (done) S.rems = S.rems.filter((x) => x !== r);
    else r.missed = true;
    save(); if (ui.panel) render();
  }
  function reminders() {
    if (ui.bubble && ui.bubble.rem) return;
    for (const r of S.rems) {
      if (r.missed || now() < r.at) continue;
      if (++r.tries > 4) { settle(r, false); continue; } // asked four times, nobody home
      r.at = now() + 5 * MIN; save();
      ui.queue.unshift({ text: `Reminder: ${r.text}`, ttl: 60000, sound: 'up', expr: 'wow', rem: true, buttons: [
        { label: 'Done', go: true, fn: () => { settle(r, true); flash('happy', 1400); } },
        { label: 'In 10 min', fn: () => { r.at = now() + 10 * MIN; r.tries = 0; save(); } }] });
      if (ui.bubble) { clearTimeout(ui.bubble.timer); ui.queue.splice(1, 0, ui.bubble); ui.bubble = null; }
      ui.panel = false; ui.quick = false; pump();
      return;
    }
  }
  function when(ts) {
    const d = new Date(ts), mins = Math.round((ts - now()) / MIN), time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (mins <= 0) return 'now';
    if (mins < 60) return `in ${mins} min`;
    const days = Math.round((new Date(d).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / DAY);
    if (days === 0) return `Today, ${time}`;
    if (days === 1) return `Tomorrow, ${time}`;
    return `${d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}, ${time}`;
  }
  // "call mom in 40 min", "standup at 9:30", "pay rent tomorrow at 6pm" -> a reminder; anything else -> a task
  function parseQuick(raw) {
    let text = raw.trim(), at = 0, m;
    if ((m = text.match(/\bin\s+(\d+(?:\.\d+)?)\s*(m|min|mins|minutes?|h|hr|hrs|hours?)\b/i))) {
      at = now() + parseFloat(m[1]) * (/^h/i.test(m[2]) ? 60 : 1) * MIN;
    } else if ((m = text.match(/\b(tomorrow\s+)?at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i))) {
      let h = +m[2]; const mi = +(m[3] || 0), ap = (m[4] || '').toLowerCase();
      if (ap === 'pm' && h < 12) h += 12; if (ap === 'am' && h === 12) h = 0;
      if (h < 24 && mi < 60) { const d = new Date(); d.setHours(h, mi, 0, 0); if (m[1] || d.getTime() <= now()) d.setDate(d.getDate() + 1); at = d.getTime(); }
    }
    if (!at) return { text };
    text = text.replace(m[0], '').replace(/^\s*(remind me to|remind me|to)\s+/i, '').replace(/\s{2,}/g, ' ').trim() || 'Reminder';
    return { text: text[0].toUpperCase() + text.slice(1), at };
  }
  function quickAdd(raw) {
    const q = parseQuick(raw); if (!q.text) return;
    if (q.at) { addReminder(q.text, q.at); say(`Reminder set: ${q.text}, ${when(q.at)}.`, { ttl: 3500, expr: 'wink' }); }
    else { S.todos.push({ id: uid(), text: q.text.slice(0, 120), done: false }); save(); say(`Added to tasks: ${q.text}`, { ttl: 3000, expr: 'happy' }); }
  }

  // ---- weeks (Monday to Sunday)
  function week(offset = 0) {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7);
    const out = { key: dayKey(d), focus: 0, pomos: 0, tasks: 0, active: 0, best: null };
    for (let i = 0; i < 7; i++) {
      const x = S.days[dayKey(d)];
      if (x) { out.focus += x.focus; out.pomos += x.pomos; out.tasks += x.tasks; if (x.pomos) out.active++; if (x.focus && (!out.best || x.focus > out.best[1])) out.best = [d.toLocaleDateString([], { weekday: 'long' }), x.focus]; }
      d.setDate(d.getDate() + 1);
    }
    return out;
  }
  function report() {
    const w = week(), p = week(-1);
    return `Deskling, week of ${w.key}\nFocus: ${w.focus} min in ${plural(w.pomos, 'session')} (last week ${p.focus} min)\nTasks done: ${w.tasks}\nActive days: ${w.active} of 7\n` +
      (w.best ? `Best day: ${w.best[0]}, ${w.best[1]} min\n` : '') + `Streak: ${plural(streak(), 'day')} (best ${S.best})`;
  }
  function copy(text, what) {
    const ok = () => { ui.err = `${what} copied. Paste it anywhere.`; if (ui.panel) render(); };
    const fallback = () => { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); ok(); } catch {} t.remove(); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, fallback); else fallback();
  }

  // ---- once a day: morning check-in, evening recap, and the Sunday report
  function daily() {
    const k = dayKey(), date = new Date(), h = date.getHours(), d = today();
    if (S.greeted !== k) {
      S.greeted = k; S.timer.count = 0;
      S.todos = S.todos.filter((t) => !t.done); save();
      const hi = h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
      say(`${hi}. What is the one thing that would make today a win?`, { ttl: 40000, expr: 'wow', buttons: [
        { label: 'Set it', go: true, fn: () => openPanel('tasks', '#intent') }, { label: 'Later' }] });
    } else if (h >= 18 && S.recapped !== k && (d.pomos || d.tasks)) {
      S.recapped = k; save();
      say(`Today: ${plural(d.pomos, 'focus session')}, ${d.focus} minutes, ${plural(d.tasks, 'task')} done. Streak: ${plural(streak(), 'day')}.`, { ttl: 20000, expr: 'happy', buttons: [{ label: 'Nice' }] });
    } else if (date.getDay() === 0 && h >= 19 && S.weekly !== week().key && week().pomos) {
      const w = week(); S.weekly = w.key; save();
      say(`Week done: ${w.focus} focus minutes, ${plural(w.tasks, 'task')}, ${w.active} active days.`, { ttl: 25000, expr: 'star', buttons: [{ label: 'See report', go: true, fn: () => openPanel('days') }, { label: 'Close' }] });
    }
  }

  // ---- updates: ask GitHub for the latest release (at most once a day)
  const newer = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };
  async function checkUpdate(manual) {
    ui.upd = { busy: true }; if (manual && ui.panel) render();
    try {
      const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
      if (!r.ok) throw new Error(r.status);
      const j = await r.json(), latest = String(j.tag_name || '').replace(/^v/, '');
      ui.upd = { latest, url: j.html_url, newer: !!ui.version && newer(latest, ui.version) };
    } catch { ui.upd = { failed: true }; }
    S.updAt = now(); save();
    if (ui.upd.newer && !manual && S.updSeen !== ui.upd.latest) {
      S.updSeen = ui.upd.latest; save(); const u = ui.upd;
      say(`Deskling ${u.latest} is out. You have ${ui.version}.`, { ttl: 25000, expr: 'wow', buttons: [{ label: 'Get the update', go: true, fn: () => Shell.open(u.url) }, { label: 'Later' }] });
    }
    if (ui.panel) render();
  }

  // ---- moving around: walkers step and sometimes run, robots hover and glide
  const walk = { on: false, dir: 1, until: now() + 4000, timer: 0, n: 0 };
  function stopWalk(rest) { clearInterval(walk.timer); walk.on = false; walk.until = now() + rest; pet.classList.remove('walk', 'run'); }
  function walking() {
    const can = S.mode === 'walk' && !ui.panel && !ui.bubble && !ui.quick;
    if (walk.on) { if (!can || now() > walk.until) stopWalk(6000 + Math.random() * 14000); return; }
    if (!can || now() < walk.until) return;
    const run = Math.random() < 0.3, hover = Buddy.byId(S.char).move === 'hover';
    walk.on = true; walk.n = 0; walk.until = now() + (run ? 1800 + Math.random() * 2200 : 3000 + Math.random() * 5000);
    if (Math.random() < 0.4) walk.dir = -walk.dir;
    pet.classList.add('walk'); pet.classList.toggle('run', run); pet.classList.toggle('left', walk.dir < 0);
    walk.timer = setInterval(() => {
      if (run && !hover && ++walk.n % 6 === 0) burst('dust', 1);
      Shell.walk(walk.dir * (run ? 5 : 2)).then((edge) => { if (edge) { walk.dir = -walk.dir; pet.classList.toggle('left', walk.dir < 0); } });
    }, 50);
  }
  function setMode(m) { S.mode = m; save(); if (m === 'walk') Shell.dock(); else stopWalk(0); ui.stageKey = ''; render(); }

  // ---- heartbeat (one tick a second, sent by the shell so nothing spins while idle)
  let blinkAt = now() + 3000, idleAt = now() + 9000, zAt = 0;
  function tick() {
    const t = S.timer;
    if (t.phase !== 'idle' && !t.paused && t.endsAt <= now()) finish();
    paintClock(); reminders(); daily(); nudges(); walking();
    if (S.autoUpd && Shell.native && ui.version && now() - S.updAt > DAY && !(ui.upd && ui.upd.busy)) checkUpdate(false);
    if (now() > blinkAt && now() > ui.flashUntil && baseExpr() !== 'sleep') {
      blinkAt = now() + 2500 + Math.random() * 4000;
      fig.set({ expr: 'blink' }); setTimeout(face, 140);
    }
    const quiet = !ui.panel && !ui.bubble && !ui.quick && !walk.on && !drag && now() > ui.flashUntil;
    if (quiet && baseExpr() === 'sleep' && now() > zAt) { zAt = now() + 2600; burst('z', 1); }
    if (quiet && baseExpr() !== 'sleep' && now() > idleAt) {
      idleAt = now() + 7000 + Math.random() * 13000;
      const late = new Date().getHours() >= 21, focus = baseExpr() === 'focus';
      const act = pick(focus ? ['glance', 'smug', 'tilt', 'peek'] : ['glance', 'glance', 'tilt', 'stretch', 'shiver', 'peek', 'wink', late ? 'yawn' : 'wink']);
      if (act === 'glance') { look(Math.random() < 0.5 ? -2 : 2, 0); setTimeout(() => look(0, 0), 1300); }
      else if (act === 'peek') { look(0, -1.6); anim('stretch', 900); setTimeout(() => look(0, 0), 1100); }
      else if (act === 'wink' || act === 'smug') flash(act, act === 'wink' ? 650 : 1500);
      else if (act === 'yawn') { flash('yawn', 1500); anim('stretch', 1400); }
      else anim(act, act === 'shiver' ? 520 : 950);
    }
  }
  function paintClock() {
    const t = S.timer, on = t.phase !== 'idle';
    pill.hidden = !on || ui.panel;
    if (on) { pill.textContent = fmt(left()); pill.className = (t.phase === 'focus' ? '' : 'rest') + (t.paused ? ' paused' : ''); pill.title = t.paused ? 'Resume' : 'Pause'; }
    const el = $('#time'); if (el) el.textContent = fmt(left());
  }

  // ---- panel
  function openPanel(tab, focusSel) {
    if (ui.bubble) { clearTimeout(ui.bubble.timer); ui.bubble = null; }
    ui.panel = true; ui.quick = false; ui.err = ''; if (tab) ui.tab = tab; render();
    if (focusSel) setTimeout(() => { const el = $(focusSel); if (el) el.focus(); }, 60);
  }
  function closePanel() { ui.panel = false; render(); setTimeout(pump, 300); }
  function openQuick() {
    if (ui.bubble) { clearTimeout(ui.bubble.timer); ui.queue.unshift(ui.bubble); ui.bubble = null; }
    ui.panel = false; ui.quick = true; render(); Shell.focus();
    setTimeout(() => { const el = $('#quick'); if (el) el.focus(); }, 80);
  }
  function closeQuick() { ui.quick = false; render(); setTimeout(pump, 200); }

  const TABS = { focus: 'Focus', tasks: 'Tasks', remind: 'Remind', days: 'Days', buddy: 'Buddy' };
  const seg = (name, cur, opts) => `<div class="seg">${opts.map(([v, l]) => `<button type="button" data-a="${name}" data-v="${v}" aria-pressed="${cur === v}">${l}</button>`).join('')}</div>`;
  const note = () => (ui.err ? `<p class="note" role="status">${esc(ui.err)}</p>` : '');

  function calendar() {
    const c = ui.cal, first = new Date(c.y, c.m, 1), lead = (first.getDay() + 6) % 7, n = new Date(c.y, c.m + 1, 0).getDate(), tk = dayKey();
    let cells = '';
    for (let i = 0; i < lead; i++) cells += '<span></span>';
    for (let d = 1; d <= n; d++) {
      const k = `${c.y}-${pad(c.m + 1)}-${pad(d)}`;
      cells += `<button type="button" data-a="calday" data-v="${k}" ${k < tk ? 'disabled' : ''} class="${k === tk ? 'now' : ''}" aria-pressed="${k === c.sel}">${d}</button>`;
    }
    const canBack = new Date(c.y, c.m, 1) > new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    return `<div class="cal"><div class="calhead"><button type="button" data-a="calnav" data-v="-1" aria-label="Previous month" ${canBack ? '' : 'disabled'}>&#8249;</button><b>${first.toLocaleDateString([], { month: 'long', year: 'numeric' })}</b><button type="button" data-a="calnav" data-v="1" aria-label="Next month">&#8250;</button></div>
      <div class="calgrid wk">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<i>${d}</i>`).join('')}</div><div class="calgrid">${cells}</div>
      <div class="opt"><span>Time</span><input type="time" data-c="caltime" value="${c.time}" aria-label="Time"></div>
      ${seg('calrep', c.repeat, Object.entries(REPEATS))}
      <button type="button" class="btn go wide" data-a="caladd">Add reminder</button></div>`;
  }

  const VIEW = {
    focus() {
      const t = S.timer, d = today(), open = S.todos.filter((x) => !x.done);
      const phase = t.phase === 'idle' ? (d.pomos ? `${d.pomos} of ${S.goal} sessions today` : 'Ready when you are')
        : ({ focus: 'Focus', short: 'Short break', long: 'Long break' }[t.phase]) + (t.paused ? ', paused' : '');
      const btns = t.phase === 'idle' ? `<button class="btn go" data-a="start">Start focus</button><button class="btn" data-a="break">Take a break</button>`
        : t.paused ? `<button class="btn go" data-a="pause">Resume</button><button class="btn" data-a="stop">Stop</button>`
        : `<button class="btn" data-a="pause">Pause</button><button class="btn" data-a="stop">Stop</button>`;
      const pips = Array.from({ length: S.pomo.every }, (_, i) => `<i class="${i < t.count % S.pomo.every || (t.count && t.count % S.pomo.every === 0 && t.phase === 'long') ? 'on' : ''}"></i>`).join('');
      const next = S.rems.find((r) => !r.missed);
      return `<div class="clock"><div class="time" id="time">${fmt(left())}</div><div class="phase">${phase}</div></div>
        <div class="pips" title="Sessions until a long break">${pips}</div><div class="center">${btns}</div>
        <div class="field"><label for="task">Working on</label><select id="task" data-c="task"><option value="">Nothing in particular</option>${open.map((x) => `<option value="${x.id}" ${t.task === x.id ? 'selected' : ''}>${esc(x.text)}</option>`).join('')}</select></div>
        ${next ? `<button class="row-link" data-a="tab" data-v="remind"><span>Next reminder</span><b>${esc(next.text)}</b><em>${when(next.at)}</em></button>` : ''}
        <div class="center quiet"><button class="link" data-a="dnd">${now() < S.dnd ? 'Turn nudges back on' : 'Mute nudges for 1 hour'}</button></div>`;
    },
    tasks() {
      const d = today(), list = S.todos;
      return `<h2>The one thing for today</h2><input type="text" id="intent" data-c="intent" maxlength="90" placeholder="What would make today a win?" value="${esc(d.intent || '')}">
        <h2>Tasks</h2>${list.length ? `<ul class="tasks">${list.map((x) => `<li class="${x.done ? 'done' : ''}"><input type="checkbox" data-c="todo" data-id="${x.id}" ${x.done ? 'checked' : ''} aria-label="Finish ${esc(x.text)}"><span>${esc(x.text)}</span><button class="del" data-a="del" data-id="${x.id}" aria-label="Delete ${esc(x.text)}">&#10005;</button></li>`).join('')}</ul>`
          : '<p class="empty">No tasks yet. Add the first thing you want to finish today.</p>'}
        <form class="add" data-f="add"><input type="text" id="new" maxlength="120" placeholder="Add a task"><button class="btn go">Add</button></form>
        ${list.some((x) => x.done) ? '<div class="foot"><span></span><button class="link" data-a="clear">Clear finished tasks</button></div>' : ''}`;
    },
    remind() {
      const list = S.rems, mins = [10, 25, 40, 60];
      return `<form data-f="rem"><input type="text" id="remtext" data-d="rem" maxlength="120" placeholder="Remind me to..." value="${esc(ui.draft.rem || '')}"></form>
        <div class="chips"><span>In</span>${mins.map((m) => `<button type="button" class="chip" data-a="remin" data-v="${m}" aria-label="In ${m} minutes">${m === 60 ? '1h' : m + 'm'}</button>`).join('')}
          <input type="number" data-d="remmin" min="1" max="1440" placeholder="min" value="${esc(ui.draft.remmin || '')}" aria-label="Minutes from now"><button type="button" class="chip" data-a="remin" data-v="custom">Set</button></div>
        ${note()}
        <button type="button" class="link" data-a="caltoggle">${ui.cal.open ? 'Hide the calendar' : 'Pick a date and time'}</button>
        ${ui.cal.open ? calendar() : ''}
        <h2>Upcoming</h2>${list.length ? `<ul class="tasks rems">${list.map((r) => `<li class="${r.missed ? 'missed' : ''}"><span>${esc(r.text)}<small>${r.missed ? 'Missed' : when(r.at)}${r.repeat !== 'once' ? ', ' + REPEATS[r.repeat].toLowerCase() : ''}</small></span><button class="del" data-a="remdel" data-id="${r.id}" aria-label="Delete reminder ${esc(r.text)}">&#10005;</button></li>`).join('')}</ul>`
          : '<p class="empty">Nothing scheduled. Type what to remember, then choose when.</p>'}
        <h2>Wellbeing nudges</h2>${Object.entries(NUDGES).map(([k, n]) => `<div class="opt"><input type="checkbox" id="n-${k}" data-c="nudge.on" data-k="${k}" ${S.nudges[k].on ? 'checked' : ''}><label for="n-${k}">${n.label}</label><em>every</em><input type="number" data-c="nudge.every" data-k="${k}" value="${S.nudges[k].every}" min="5" max="240" aria-label="${n.label} interval in minutes"><em>min</em></div>`).join('')}
        <p class="empty">Nudges wait until your focus session ends. Your own reminders always arrive on time.</p>`;
    },
    days() {
      const d = today(), n = streak(), days = [], w = week(), p = week(-1), diff = w.focus - p.focus;
      for (let i = 6; i >= 0; i--) { const x = new Date(); x.setDate(x.getDate() - i); days.push([x, (S.days[dayKey(x)] || {}).focus || 0]); }
      const max = Math.max(60, ...days.map((x) => x[1]));
      return `<div class="streak"><b>${n}</b><span>day streak</span><small>Best: ${S.best}</small></div>
        <h2>Focus minutes, last 7 days</h2><div class="week">${days.map(([x, m], i) => `<div class="${i === 6 ? 'today' : ''}" title="${m} min"><i class="${m ? 'has' : ''}" style="height:${Math.round((m / max) * 100)}%"></i>${'SMTWTFS'[x.getDay()]}</div>`).join('')}</div>
        <h2>This week</h2><div class="tally">
          <div>Focus minutes<b>${w.focus}</b></div><div>Sessions<b>${w.pomos}</b></div>
          <div>Tasks done<b>${w.tasks}</b></div><div>Active days<b>${w.active} of 7</b></div></div>
        <p class="empty">${p.focus || w.focus ? (diff === 0 ? 'Level with last week.' : `${Math.abs(diff)} min ${diff > 0 ? 'more' : 'less'} focus than last week.`) : 'A day counts once you finish one focus session.'}${w.best ? ` Best day: ${w.best[0]}, ${w.best[1]} min.` : ''}</p>
        <h2>Today</h2><div class="tally">
          <div>Sessions<b>${d.pomos} of ${S.goal}</b></div><div>Focus minutes<b>${d.focus}</b></div>
          <div>Tasks done<b>${d.tasks}</b></div><div>Water<b>${d.water}</b></div>
          <div>Stretches<b>${d.moves}</b></div><div>Eye breaks<b>${d.eyes}</b></div></div>
        ${note()}<div class="foot"><button class="link" data-a="copyreport">Copy weekly report</button><button class="link" data-a="export">Copy all my data</button></div>`;
    },
    buddy() {
      const num = (c, v, min, max) => `<input type="number" data-c="${c}" value="${v}" min="${min}" max="${max}">`;
      const u = ui.upd || {};
      const status = u.busy ? 'Checking...' : u.failed ? 'Could not reach GitHub. Check your connection and try again.'
        : u.newer ? `Version ${u.latest} is available.` : u.latest ? (ui.version ? 'You have the latest version.' : `Latest release: ${u.latest}.`) : '';
      return `<h2>Character</h2><div class="roster">${Buddy.CHARS.map((c) => `<button data-a="char" data-v="${c.id}" aria-pressed="${S.char === c.id}"><div class="mini" data-char="${c.id}"></div>${esc(c.name)}</button>`).join('')}</div>
        <h2>Look</h2>${seg('look', S.look, [['pixel', 'Pixel'], ['soft', 'Soft'], ['neon', 'Neon']])}
        <h2>Size</h2>${seg('size', S.size, [['s', 'Small'], ['m', 'Medium'], ['l', 'Large']])}
        <h2>Where it lives</h2>${seg('mode', S.mode, [['sit', 'Sits still'], ['walk', 'Roams'], ['hide', 'Hides']])}
        <p class="empty">${{ sit: 'Stays where you drag it.', walk: 'Walks, runs or hovers along the bottom of your screen.', hide: 'Stays in the tray and pops out only for reminders.' }[S.mode]}</p>
        <h2>Timer</h2>
        <label class="opt"><span>Focus session</span>${num('pomo.focus', S.pomo.focus, 5, 120)}<em>min</em></label>
        <label class="opt"><span>Short break</span>${num('pomo.short', S.pomo.short, 1, 30)}<em>min</em></label>
        <label class="opt"><span>Long break</span>${num('pomo.long', S.pomo.long, 5, 60)}<em>min</em></label>
        <label class="opt"><span>Daily goal</span>${num('goal', S.goal, 1, 16)}<em>sessions</em></label>
        <h2>App</h2><label class="opt"><input type="checkbox" data-c="sound" ${S.sound ? 'checked' : ''}><span>Play a short chime</span></label>
        ${Shell.native ? `<label class="opt"><input type="checkbox" data-c="autostart" id="autostart"><span>Start when my computer starts</span></label>
          <label class="opt"><input type="checkbox" data-c="autoUpd" ${S.autoUpd ? 'checked' : ''}><span>Check for updates once a day</span></label>
          <p class="empty">Quick add from anywhere: Ctrl + Alt + Space.</p>` : ''}
        <div class="update"><span>${ui.version ? `Version ${ui.version}` : 'Web demo'}</span>${u.newer ? `<button class="btn go sm" data-a="getupd">Get ${esc(u.latest)}</button>` : `<button class="btn sm" data-a="checkupd" ${u.busy ? 'disabled' : ''}>Check for updates</button>`}</div>
        ${status ? `<p class="note" role="status">${status}</p>` : ''}
        ${Shell.native ? '<div class="foot"><span></span><button class="link" data-a="quit">Quit Deskling</button></div>' : ''}`;
    },
  };

  function render() {
    let html = '', kind = '';
    if (ui.panel) {
      kind = 'panel';
      html = `<div class="card panel"><div class="tabs" role="tablist">${Object.entries(TABS).map(([k, l]) => `<button role="tab" data-a="tab" data-v="${k}" aria-selected="${ui.tab === k}">${l}</button>`).join('')}<button class="x" data-a="close" aria-label="Close">&#10005;</button></div><div class="body">${VIEW[ui.tab]()}</div></div>`;
    } else if (ui.quick) {
      kind = 'quick';
      html = `<form class="card say quick" data-f="quick"><label for="quick">Quick add</label><input type="text" id="quick" maxlength="140" placeholder="Buy milk, or: call mom in 40 min" autocomplete="off"><small>Enter to add. Write "in 40 min" or "at 5pm" to make it a reminder.</small></form>`;
    } else if (ui.bubble) {
      const b = ui.bubble; kind = 'say' + b.text;
      html = `<div class="card say" role="status">${esc(b.text)}${b.buttons ? `<div class="row">${b.buttons.map((x, i) => `<button class="btn sm ${x.go ? 'go' : ''}" data-a="bubble" data-v="${i}">${esc(x.label)}</button>`).join('')}</div>` : ''}</div>`;
    }
    const body = $('.body'), keep = body ? body.scrollTop : 0, sameTab = body && body.dataset.tab === ui.tab;
    above.hidden = !html; above.innerHTML = html;
    document.documentElement.classList.toggle('open', !!html);
    const card = above.firstElementChild;
    if (card && kind !== ui.shown) card.classList.add('in'); // animate only when something new appears, not on every repaint
    ui.shown = kind;
    if ($('.body')) { $('.body').dataset.tab = ui.tab; if (sameTab) $('.body').scrollTop = keep; }
    above.querySelectorAll('.mini').forEach((el) => Buddy.mount(el, { char: el.dataset.char, look: S.look }));
    if (ui.panel && ui.tab === 'buddy' && Shell.native) Shell.autostart.get().then((on) => { const el = $('#autostart'); if (el) el.checked = !!on; });
    paintClock(); layout();
  }

  // ---- actions
  function remindIn(v) {
    const text = (ui.draft.rem || '').trim(), mins = v === 'custom' ? Math.round(+ui.draft.remmin) : +v;
    if (!text) { ui.err = 'Write what to remember first.'; setTimeout(() => { const el = $('#remtext'); if (el) el.focus(); }, 30); return; }
    if (!(mins >= 1 && mins <= 1440)) { ui.err = 'Enter the minutes, between 1 and 1440.'; return; }
    addReminder(text, now() + mins * MIN); ui.draft.rem = ''; ui.draft.remmin = ''; ui.err = `Set for ${when(now() + mins * MIN)}.`; flash('wink', 700);
  }
  function calAdd() {
    const c = ui.cal, text = (ui.draft.rem || '').trim(), [h, mi] = c.time.split(':').map(Number), [y, m, d] = c.sel.split('-').map(Number);
    const at = new Date(y, m - 1, d, h || 0, mi || 0).getTime();
    if (!text) { ui.err = 'Write what to remember first.'; setTimeout(() => { const el = $('#remtext'); if (el) el.focus(); }, 30); return; }
    if (at <= now()) { ui.err = 'That time has already passed. Pick a later one.'; return; }
    addReminder(text, at, c.repeat); ui.draft.rem = ''; ui.err = `Set for ${when(at)}.`; c.open = false; flash('wink', 700);
  }
  const ACT = {
    tab: (v) => { ui.tab = v; ui.err = ''; },
    close: closePanel,
    start: () => start('focus'), break: () => start('short'), pause, stop: () => stop(true),
    dnd: () => { S.dnd = now() < S.dnd ? 0 : now() + 60 * MIN; },
    del: (v, el) => { S.todos = S.todos.filter((x) => x.id !== el.dataset.id); },
    clear: () => { S.todos = S.todos.filter((x) => !x.done); },
    remin: remindIn, caladd: calAdd,
    remdel: (v, el) => { S.rems = S.rems.filter((x) => x.id !== el.dataset.id); },
    caltoggle: () => { ui.cal.open = !ui.cal.open; ui.err = ''; },
    calnav: (v) => { const d = new Date(ui.cal.y, ui.cal.m + +v, 1); ui.cal.y = d.getFullYear(); ui.cal.m = d.getMonth(); },
    calday: (v) => { ui.cal.sel = v; },
    calrep: (v) => { ui.cal.repeat = v; },
    copyreport: () => copy(report(), 'Weekly report'),
    export: () => copy(JSON.stringify(S, null, 2), 'Your data'),
    checkupd: () => { checkUpdate(true); return false; },
    getupd: () => { Shell.open(ui.upd.url); },
    char: (v) => { S.char = v; face(); anim('boing', 460); burst('star', 5); },
    look: (v) => { S.look = v; face(); },
    size: (v) => { S.size = v; ui.stageKey = ''; },
    mode: (v) => setMode(v),
    quit: () => Shell.quit(),
    bubble: (v) => { const b = ui.bubble, x = b && b.buttons[+v]; closeBubble(b); if (x && x.fn) x.fn(); },
  };
  above.addEventListener('click', (e) => {
    const el = e.target.closest('[data-a]'); if (!el) return;
    const r = ACT[el.dataset.a](el.dataset.v, el);
    save(); if (el.dataset.a !== 'bubble' && el.dataset.a !== 'close' && r !== false) render();
  });
  above.addEventListener('input', (e) => { const d = e.target.dataset.d; if (d) ui.draft[d] = e.target.value; });
  above.addEventListener('change', (e) => {
    const el = e.target, c = el.dataset.c; if (!c) return;
    const n = () => { const v = Math.min(+el.max, Math.max(+el.min, Math.round(+el.value) || +el.min)); el.value = v; return v; };
    if (c === 'todo') {
      const x = S.todos.find((t) => t.id === el.dataset.id); if (!x) return;
      x.done = el.checked; today().tasks = Math.max(0, today().tasks + (x.done ? 1 : -1));
      if (x.done) { if (S.timer.task === x.id) S.timer.task = ''; flash('star', 1600); anim('cheer', 850); burst('confetti', 10); chime(true); ui.queue.push({ text: pick(CHEERS), ttl: 3500 }); }
      render();
    } else if (c === 'task') S.timer.task = el.value;
    else if (c === 'intent') today().intent = el.value.trim();
    else if (c === 'caltime') ui.cal.time = el.value || ui.cal.time;
    else if (c === 'sound') { S.sound = el.checked; chime(true); }
    else if (c === 'autostart') Shell.autostart.set(el.checked);
    else if (c === 'autoUpd') S.autoUpd = el.checked;
    else if (c === 'goal') S.goal = n();
    else if (c.startsWith('pomo.')) S.pomo[c.slice(5)] = n();
    else if (c === 'nudge.on') { S.nudges[el.dataset.k].on = el.checked; S.next[el.dataset.k] = now() + S.nudges[el.dataset.k].every * MIN; }
    else if (c === 'nudge.every') { S.nudges[el.dataset.k].every = n(); S.next[el.dataset.k] = now() + n() * MIN; }
    save();
  });
  above.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target.dataset.f;
    if (f === 'add') {
      const text = $('#new').value.trim(); if (!text) return;
      S.todos.push({ id: uid(), text, done: false }); save(); render(); $('#new').focus();
    } else if (f === 'quick') {
      const text = $('#quick').value.trim(); ui.quick = false; if (text) quickAdd(text); render(); setTimeout(pump, 150);
    } else if (f === 'rem') {
      // Enter in the reminder box: understand "in 40 min" / "at 5pm" typed inline, otherwise open the calendar
      const q = parseQuick(ui.draft.rem || '');
      if (q.at) { addReminder(q.text, q.at); ui.draft.rem = ''; ui.err = `Set for ${when(q.at)}.`; flash('wink', 700); }
      else if (q.text) { ui.cal.open = true; ui.err = 'Now choose when: a chip above, or a date and time below.'; }
      render();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (ui.quick) closeQuick(); else if (ui.panel) closePanel();
  });

  // ---- the figurine itself: click to open, drag to move, right-click for a trick
  let down = null, drag = false, clicks = [];
  pet.addEventListener('mousedown', (e) => { if (e.button === 0) { down = { x: e.screenX, y: e.screenY, moved: false }; anim('squash'); } });
  pet.addEventListener('mouseenter', () => {
    if (drag || down || walk.on) return; anim('perk', 360);
    if (baseExpr() !== 'idle') return;
    if (S.char === 'biscuit' || S.char === 'max') flash('happy', 1400); else if (S.char === 'miso') flash('sleep', 700);
  });
  function landed() { drag = false; down = null; ui.flashUntil = 0; face(); anim('land', 480); burst('dust', 4); }
  window.addEventListener('mousemove', (e) => {
    if (drag && !e.buttons) landed();
    const r = pet.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height * 0.45);
    const d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 40) * 2;
    look(((dx / d) * k).toFixed(1), ((dy / d) * k * 0.7).toFixed(1));
    if (!down || down.moved || Math.abs(e.screenX - down.x) + Math.abs(e.screenY - down.y) < 5) return;
    down.moved = true;
    if (!ui.panel && !ui.bubble && !ui.quick) { stopWalk(8000); drag = true; ui.flash = 'wow'; ui.flashUntil = now() + 60000; face(); anim('drag'); Shell.drag(); }
    else anim('boing', 460);
  });
  document.addEventListener('mouseleave', () => look(0, 0));
  window.addEventListener('mouseup', () => { if (drag) landed(); });
  pet.addEventListener('click', () => {
    const moved = down && down.moved; down = null; if (moved) return;
    clicks = clicks.filter((t) => now() - t < 1200); clicks.push(now());
    if (clicks.length >= 4) { clicks = []; flash('dizzy', 1700); anim('dizzy', 1100); burst('star', 5); return; }
    anim('boing', 460);
    if (ui.quick) closeQuick(); else if (ui.bubble) closeBubble(); else ui.panel ? closePanel() : openPanel();
  });
  pet.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ui.panel ? closePanel() : openPanel(); } });
  pet.addEventListener('contextmenu', (e) => {
    e.preventDefault(); if (ui.panel || ui.bubble || ui.quick) return;
    const mood = pick(['love', 'wink', 'happy', 'star']);
    say(pick((VOICE[S.char] || []).concat(PATS)), { ttl: 4000, expr: mood });
    anim(pick([TRICK[S.char] || 'flip', TRICK[S.char] || 'flip', 'wiggle']), 1000); burst(mood === 'love' ? 'heart' : 'star', 6);
  });
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  pill.addEventListener('click', pause);
  const dq = $('#demo-quick'); if (dq) dq.addEventListener('click', openQuick);

  Shell.onTick(tick);
  Shell.onTray((id) => {
    if (id === 'open') openPanel();
    else if (id === 'quick') openQuick();
    else if (id === 'focus') { S.timer.phase === 'idle' ? start('focus') : pause(); say(S.timer.phase === 'focus' && !S.timer.paused ? 'Focus started.' : 'Timer paused.', { ttl: 2500 }); }
    else if (id.startsWith('mode-')) setMode(id.slice(5));
  });
  Shell.version().then((v) => { ui.version = v || null; });

  face(); render();
  if (S.mode === 'walk') Shell.dock();
  window.Deskling = { S, ui, say, openPanel, openQuick, quickAdd, parseQuick, addReminder, tick, flash, anim }; // handy in the dev console
})();
