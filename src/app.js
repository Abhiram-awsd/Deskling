/* Deskling app logic: focus timer, tasks, reminders, stats, and the panel UI.
   No framework, no build step. State lives in localStorage on your own machine. */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MIN = 60000, now = () => Date.now();
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const NUDGES = {
    water: { label: 'Drink water', text: 'Water break. Take a few sips.', yes: 'Drank it', stat: 'water', every: 45, on: true },
    move: { label: 'Stand up and stretch', text: 'You have been sitting a while. Stand up and stretch for a minute.', yes: 'Stretched', stat: 'moves', every: 60, on: true },
    eyes: { label: 'Rest your eyes', text: 'Eye break. Look at something far away for 20 seconds.', yes: 'Done', stat: 'eyes', every: 20, on: true },
    posture: { label: 'Check posture', text: 'Posture check. Shoulders down, back straight.', yes: 'Fixed it', stat: null, every: 30, on: false },
  };
  const SIZES = { s: 76, m: 104, l: 136 };
  const CHEERS = ['Done. Next.', 'One down.', 'Clean work.', 'That is how it is done.', 'Knocked out.'];
  const PATS = ['Locked in?', 'Pick one task and start the timer.', 'Small steps still count.', 'You have got this.', 'What is the next move?'];

  // ---- state
  const KEY = 'deskling.v1';
  const S = Object.assign({
    char: 'bolt', look: 'soft', size: 'm', mode: 'sit', sound: true, goal: 4,
    pomo: { focus: 25, short: 5, long: 15, every: 4 },
    nudges: Object.fromEntries(Object.entries(NUDGES).map(([k, n]) => [k, { on: n.on, every: n.every }])),
    todos: [], days: {}, best: 0, next: {}, dnd: 0, greeted: '', recapped: '',
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

  // ---- startup housekeeping
  (function tidy() {
    const cut = new Date(); cut.setDate(cut.getDate() - 90); const ck = dayKey(cut);
    for (const k of Object.keys(S.days)) if (k < ck) delete S.days[k];
    const t = S.timer;
    if (t.phase !== 'idle' && !t.paused && t.endsAt < now()) Object.assign(t, { phase: 'idle', endsAt: 0, left: 0 });
    for (const k in NUDGES) if (!S.next[k] || S.next[k] < now()) S.next[k] = now() + S.nudges[k].every * MIN;
  })();

  // ---- view state
  const ui = { panel: false, tab: 'focus', bubble: null, queue: [], flash: null, flashUntil: 0, stageKey: '' };
  const pet = $('#pet'), above = $('#above'), pill = $('#pill');
  const fig = Buddy.mount($('#fig'), { char: S.char, look: S.look });

  function baseExpr() {
    const t = S.timer, h = new Date().getHours();
    if (t.phase === 'focus' && !t.paused) return 'focus';
    if (t.phase !== 'idle' && !t.paused) return 'happy';
    return h >= 23 || h < 5 ? 'sleep' : 'idle';
  }
  function face() { fig.set({ char: S.char, look: S.look, expr: now() < ui.flashUntil ? ui.flash : baseExpr() }); }
  function flash(expr, ms = 1800, hop) {
    ui.flash = expr; ui.flashUntil = now() + ms; face(); setTimeout(face, ms + 30);
    if (hop) { pet.classList.remove('hop'); void pet.offsetWidth; pet.classList.add('hop'); setTimeout(() => pet.classList.remove('hop'), 1100); }
  }

  function chime(up = true) {
    if (!S.sound) return;
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      (up ? [660, 880] : [520, 392]).forEach((f, i) => {
        const o = ac.createOscillator(), g = ac.createGain(), t0 = ac.currentTime + i * 0.14;
        o.type = 'triangle'; o.frequency.value = f; o.connect(g); g.connect(ac.destination);
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
        o.start(t0); o.stop(t0 + 0.34);
      });
      setTimeout(() => ac.close(), 900);
    } catch {}
  }

  // ---- window layout: the window is only ever as big as what is on screen
  function layout() {
    const px = SIZES[S.size]; document.documentElement.style.setProperty('--size', px + 'px');
    const pw = px + 24, ph = px + 34;
    const st = ui.panel ? [348, ph + 440, false] : ui.bubble ? [296, ph + 170, false] : [Math.max(pw, 110), ph, true];
    const visible = S.mode !== 'hide' || ui.panel || !!ui.bubble;
    const key = st.join() + visible;
    if (key === ui.stageKey) return;
    ui.stageKey = key;
    Shell.stage(st[0], st[1], st[2]);
    visible ? Shell.show() : Shell.hide();
  }

  // ---- speech bubbles
  function say(text, o = {}) { ui.queue.push(Object.assign({ text, ttl: 6000 }, o)); pump(); }
  function pump() {
    if (ui.bubble || ui.panel || !ui.queue.length) return;
    const b = (ui.bubble = ui.queue.shift());
    if (b.expr) flash(b.expr, 2200, b.hop);
    if (b.sound) chime(b.sound === 'up');
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
  const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
  const left = () => { const t = S.timer; return t.phase === 'idle' ? S.pomo.focus * MIN : t.paused ? t.left : t.endsAt - now(); };
  function start(phase) {
    Object.assign(S.timer, { phase, endsAt: now() + S.pomo[phase] * MIN, paused: false, left: 0 });
    save(); face(); render();
  }
  function pause() { const t = S.timer; if (t.phase === 'idle') return; if (t.paused) { t.endsAt = now() + t.left; t.paused = false; } else { t.left = t.endsAt - now(); t.paused = true; } save(); face(); render(); }
  function stop() { Object.assign(S.timer, { phase: 'idle', endsAt: 0, left: 0, paused: false }); save(); face(); render(); }
  function finish() {
    const t = S.timer;
    if (t.phase === 'focus') {
      const d = today(); d.pomos++; d.focus += S.pomo.focus; t.count++;
      const long = t.count % S.pomo.every === 0, n = streak();
      start(long ? 'long' : 'short');
      const hit = d.pomos === S.goal ? ` That is your goal of ${S.goal} for today.` : '';
      say(`Session ${d.pomos} done.${hit} ${long ? 'Take a long' : 'Take a short'} break, ${S.pomo[long ? 'long' : 'short']} minutes.` + (d.pomos === 1 && n > 1 ? ` Streak: ${n} days.` : ''),
        { ttl: 12000, expr: 'happy', hop: true, sound: 'up', buttons: [{ label: 'Skip break', fn: stop }] });
    } else {
      stop();
      say('Break is over. Ready for the next session?', { ttl: 30000, sound: 'down', buttons: [{ label: 'Start focus', go: true, fn: () => start('focus') }, { label: 'Not now' }] });
    }
  }

  // ---- reminders: held back during a focus session, delivered at the next break
  function nudges() {
    if (now() < S.dnd || (S.timer.phase === 'focus' && !S.timer.paused) || ui.bubble || ui.panel || ui.queue.length) return;
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

  // ---- once a day: morning check-in and evening recap
  function daily() {
    const k = dayKey(), h = new Date().getHours(), d = today();
    if (S.greeted !== k) {
      S.greeted = k; S.timer.count = 0;
      S.todos = S.todos.filter((t) => !t.done); save();
      const hi = h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
      say(`${hi}. What is the one thing that would make today a win?`, { ttl: 40000, expr: 'wow', buttons: [
        { label: 'Set it', go: true, fn: () => openPanel('tasks', '#intent') }, { label: 'Later' }] });
    } else if (h >= 18 && S.recapped !== k && (d.pomos || d.tasks)) {
      S.recapped = k; save();
      say(`Today: ${d.pomos} focus ${d.pomos === 1 ? 'session' : 'sessions'}, ${d.focus} minutes, ${d.tasks} ${d.tasks === 1 ? 'task' : 'tasks'} done. Streak: ${streak()} ${streak() === 1 ? 'day' : 'days'}.`, { ttl: 20000, expr: 'happy', buttons: [{ label: 'Nice' }] });
    }
  }

  // ---- walking
  const walk = { on: false, dir: 1, until: now() + 4000, timer: 0 };
  function stopWalk(rest) { clearInterval(walk.timer); walk.on = false; walk.until = now() + rest; pet.classList.remove('walk'); }
  function walking() {
    const can = S.mode === 'walk' && !ui.panel && !ui.bubble;
    if (walk.on) { if (!can || now() > walk.until) stopWalk(6000 + Math.random() * 14000); return; }
    if (!can || now() < walk.until) return;
    walk.on = true; walk.until = now() + 3000 + Math.random() * 5000;
    if (Math.random() < 0.4) walk.dir = -walk.dir;
    pet.classList.add('walk'); pet.classList.toggle('left', walk.dir < 0);
    walk.timer = setInterval(() => Shell.walk(walk.dir * 2).then((edge) => { if (edge) { walk.dir = -walk.dir; pet.classList.toggle('left', walk.dir < 0); } }), 50);
  }
  function setMode(m) { S.mode = m; save(); if (m === 'walk') Shell.dock(); else stopWalk(0); ui.stageKey = ''; render(); }

  // ---- heartbeat (one tick a second, sent by the shell so nothing spins while idle)
  let blinkAt = now() + 3000;
  function tick() {
    const t = S.timer;
    if (t.phase !== 'idle' && !t.paused && t.endsAt <= now()) finish();
    paintClock(); daily(); nudges(); walking();
    if (now() > blinkAt && now() > ui.flashUntil && baseExpr() !== 'sleep') {
      blinkAt = now() + 2500 + Math.random() * 4000;
      fig.set({ expr: 'blink' }); setTimeout(face, 140);
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
    ui.panel = true; if (tab) ui.tab = tab; render();
    if (focusSel) setTimeout(() => { const el = $(focusSel); if (el) el.focus(); }, 60);
  }
  function closePanel() { ui.panel = false; render(); setTimeout(pump, 300); }

  const TABS = { focus: 'Focus', tasks: 'Tasks', days: 'Days', buddy: 'Buddy' };
  const seg = (name, cur, opts) => `<div class="seg">${opts.map(([v, l]) => `<button data-a="${name}" data-v="${v}" aria-pressed="${cur === v}">${l}</button>`).join('')}</div>`;

  const VIEW = {
    focus() {
      const t = S.timer, d = today(), open = S.todos.filter((x) => !x.done);
      const phase = t.phase === 'idle' ? (d.pomos ? `${d.pomos} of ${S.goal} sessions today` : 'Ready when you are')
        : ({ focus: 'Focus', short: 'Short break', long: 'Long break' }[t.phase]) + (t.paused ? ', paused' : '');
      const btns = t.phase === 'idle' ? `<button class="btn go" data-a="start">Start focus</button><button class="btn" data-a="break">Take a break</button>`
        : t.paused ? `<button class="btn go" data-a="pause">Resume</button><button class="btn" data-a="stop">Stop</button>`
        : `<button class="btn" data-a="pause">Pause</button><button class="btn" data-a="skip">Skip</button>`;
      const pips = Array.from({ length: S.pomo.every }, (_, i) => `<i class="${i < t.count % S.pomo.every || (t.count && t.count % S.pomo.every === 0 && t.phase === 'long') ? 'on' : ''}"></i>`).join('');
      const muted = now() < S.dnd;
      return `<div class="clock"><div class="time" id="time">${fmt(left())}</div><div class="phase">${phase}</div></div>
        <div class="pips" title="Sessions until a long break">${pips}</div><div class="center">${btns}</div>
        <div class="field"><label for="task">Working on</label><select id="task" data-c="task"><option value="">Nothing in particular</option>${open.map((x) => `<option value="${x.id}" ${t.task === x.id ? 'selected' : ''}>${esc(x.text)}</option>`).join('')}</select></div>
        <div class="center" style="margin-top:10px"><button class="link" data-a="dnd">${muted ? 'Turn reminders back on' : 'Mute reminders for 1 hour'}</button></div>`;
    },
    tasks() {
      const d = today(), list = S.todos;
      return `<h2>The one thing for today</h2><input type="text" id="intent" data-c="intent" maxlength="90" placeholder="What would make today a win?" value="${esc(d.intent || '')}">
        <h2>Tasks</h2>${list.length ? `<ul class="tasks">${list.map((x) => `<li class="${x.done ? 'done' : ''}"><input type="checkbox" data-c="todo" data-id="${x.id}" ${x.done ? 'checked' : ''} aria-label="Finish ${esc(x.text)}"><span>${esc(x.text)}</span><button class="del" data-a="del" data-id="${x.id}" aria-label="Delete ${esc(x.text)}">&#10005;</button></li>`).join('')}</ul>`
          : '<p class="empty">No tasks yet. Add the first thing you want to finish today.</p>'}
        <form class="add" data-f="add"><input type="text" id="new" maxlength="120" placeholder="Add a task"><button class="btn go">Add</button></form>
        ${list.some((x) => x.done) ? '<div class="foot"><span></span><button class="link" data-a="clear">Clear finished tasks</button></div>' : ''}`;
    },
    days() {
      const d = today(), n = streak(), days = [];
      for (let i = 6; i >= 0; i--) { const x = new Date(); x.setDate(x.getDate() - i); days.push([x, (S.days[dayKey(x)] || {}).focus || 0]); }
      const max = Math.max(60, ...days.map((x) => x[1]));
      return `<div class="streak"><b>${n}</b><span>day streak</span><small>Best: ${S.best}</small></div>
        <p class="empty">A day counts once you finish one focus session.</p>
        <h2>Focus minutes, last 7 days</h2><div class="week">${days.map(([x, m], i) => `<div class="${i === 6 ? 'today' : ''}" title="${m} min"><i class="${m ? 'has' : ''}" style="height:${Math.round((m / max) * 100)}%"></i>${'SMTWTFS'[x.getDay()]}</div>`).join('')}</div>
        <h2>Today</h2><div class="tally">
          <div>Focus sessions<b>${d.pomos} of ${S.goal}</b></div><div>Focus minutes<b>${d.focus}</b></div>
          <div>Tasks done<b>${d.tasks}</b></div><div>Water breaks<b>${d.water}</b></div>
          <div>Stretch breaks<b>${d.moves}</b></div><div>Eye breaks<b>${d.eyes}</b></div></div>`;
    },
    buddy() {
      const num = (c, v, min, max) => `<input type="number" data-c="${c}" value="${v}" min="${min}" max="${max}">`;
      return `<h2>Character</h2><div class="roster">${Buddy.CHARS.map((c) => `<button data-a="char" data-v="${c.id}" aria-pressed="${S.char === c.id}"><div class="mini" data-char="${c.id}"></div>${esc(c.name)}</button>`).join('')}</div>
        <h2>Look</h2>${seg('look', S.look, [['pixel', 'Pixel'], ['soft', 'Soft'], ['neon', 'Neon']])}
        <h2>Size</h2>${seg('size', S.size, [['s', 'Small'], ['m', 'Medium'], ['l', 'Large']])}
        <h2>Where it lives</h2>${seg('mode', S.mode, [['sit', 'Sits still'], ['walk', 'Walks'], ['hide', 'Hides']])}
        <p class="empty">${{ sit: 'Stays where you drag it.', walk: 'Strolls along the bottom of your screen.', hide: 'Stays in the tray and pops out only for reminders.' }[S.mode]}</p>
        <h2>Timer</h2>
        <label class="opt"><span>Focus session</span>${num('pomo.focus', S.pomo.focus, 5, 120)}<em>min</em></label>
        <label class="opt"><span>Short break</span>${num('pomo.short', S.pomo.short, 1, 30)}<em>min</em></label>
        <label class="opt"><span>Long break</span>${num('pomo.long', S.pomo.long, 5, 60)}<em>min</em></label>
        <label class="opt"><span>Daily goal</span>${num('goal', S.goal, 1, 16)}<em>sessions</em></label>
        <h2>Reminders</h2>${Object.entries(NUDGES).map(([k, n]) => `<div class="opt"><input type="checkbox" id="n-${k}" data-c="nudge.on" data-k="${k}" ${S.nudges[k].on ? 'checked' : ''}><label for="n-${k}" style="flex:1">${n.label}</label><span style="flex:none">every</span><input type="number" data-c="nudge.every" data-k="${k}" value="${S.nudges[k].every}" min="5" max="240" aria-label="${n.label} interval in minutes"><em>min</em></div>`).join('')}
        <h2>App</h2><label class="opt"><input type="checkbox" data-c="sound" ${S.sound ? 'checked' : ''}><span>Play a short chime</span></label>
        ${Shell.native ? '<label class="opt"><input type="checkbox" data-c="autostart" id="autostart"><span>Start when my computer starts</span></label><div class="foot"><span></span><button class="link" data-a="quit">Quit Deskling</button></div>' : ''}`;
    },
  };

  function render() {
    let html = '';
    if (ui.panel) {
      html = `<div class="card panel"><div class="tabs" role="tablist">${Object.entries(TABS).map(([k, l]) => `<button role="tab" data-a="tab" data-v="${k}" aria-selected="${ui.tab === k}">${l}</button>`).join('')}<button class="x" data-a="close" aria-label="Close">&#10005;</button></div><div class="body">${VIEW[ui.tab]()}</div></div>`;
    } else if (ui.bubble) {
      const b = ui.bubble;
      html = `<div class="card say" role="status">${esc(b.text)}${b.buttons ? `<div class="row">${b.buttons.map((x, i) => `<button class="btn sm ${x.go ? 'go' : ''}" data-a="bubble" data-v="${i}">${esc(x.label)}</button>`).join('')}</div>` : ''}</div>`;
    }
    const keep = $('.body') ? $('.body').scrollTop : 0;
    above.hidden = !html; above.innerHTML = html;
    if ($('.body')) $('.body').scrollTop = keep;
    above.querySelectorAll('.mini').forEach((el) => Buddy.mount(el, { char: el.dataset.char, look: S.look }));
    if (ui.panel && ui.tab === 'buddy' && Shell.native) Shell.autostart.get().then((on) => { const el = $('#autostart'); if (el) el.checked = !!on; });
    paintClock(); layout();
  }

  // ---- actions
  const ACT = {
    tab: (v) => { ui.tab = v; },
    close: closePanel,
    start: () => start('focus'), break: () => start('short'), pause, stop,
    skip: () => (S.timer.phase === 'focus' ? stop() : stop()),
    dnd: () => { S.dnd = now() < S.dnd ? 0 : now() + 60 * MIN; },
    del: (v, el) => { S.todos = S.todos.filter((x) => x.id !== el.dataset.id); },
    clear: () => { S.todos = S.todos.filter((x) => !x.done); },
    char: (v) => { S.char = v; face(); },
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
  above.addEventListener('change', (e) => {
    const el = e.target, c = el.dataset.c; if (!c) return;
    const n = () => { const v = Math.min(+el.max, Math.max(+el.min, Math.round(+el.value) || +el.min)); el.value = v; return v; };
    if (c === 'todo') {
      const x = S.todos.find((t) => t.id === el.dataset.id); if (!x) return;
      x.done = el.checked; today().tasks = Math.max(0, today().tasks + (x.done ? 1 : -1));
      if (x.done) { if (S.timer.task === x.id) S.timer.task = ''; flash('happy', 1600, true); chime(true); ui.queue.push({ text: pick(CHEERS), ttl: 3500 }); }
      render();
    } else if (c === 'task') S.timer.task = el.value;
    else if (c === 'intent') today().intent = el.value.trim();
    else if (c === 'sound') { S.sound = el.checked; chime(true); }
    else if (c === 'autostart') Shell.autostart.set(el.checked);
    else if (c === 'goal') S.goal = n();
    else if (c.startsWith('pomo.')) S.pomo[c.slice(5)] = n();
    else if (c === 'nudge.on') { S.nudges[el.dataset.k].on = el.checked; S.next[el.dataset.k] = now() + S.nudges[el.dataset.k].every * MIN; }
    else if (c === 'nudge.every') { S.nudges[el.dataset.k].every = n(); S.next[el.dataset.k] = now() + n() * MIN; }
    save();
  });
  above.addEventListener('submit', (e) => {
    e.preventDefault();
    const inp = $('#new'), text = inp.value.trim(); if (!text) return;
    S.todos.push({ id: now().toString(36) + Math.random().toString(36).slice(2, 5), text, done: false });
    save(); render(); $('#new').focus();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && ui.panel) closePanel(); });

  // ---- the figurine itself: click to open, drag to move, right-click for a pat
  let down = null;
  pet.addEventListener('mousedown', (e) => { if (e.button === 0) down = { x: e.screenX, y: e.screenY, moved: false }; });
  window.addEventListener('mousemove', (e) => {
    if (!down || down.moved || Math.abs(e.screenX - down.x) + Math.abs(e.screenY - down.y) < 5) return;
    down.moved = true;
    if (!ui.panel && !ui.bubble) { stopWalk(8000); Shell.drag(); }
  });
  pet.addEventListener('click', () => {
    const moved = down && down.moved; down = null; if (moved) return;
    if (ui.bubble) closeBubble(); else ui.panel ? closePanel() : openPanel();
  });
  pet.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ui.panel ? closePanel() : openPanel(); } });
  pet.addEventListener('contextmenu', (e) => { e.preventDefault(); if (!ui.panel && !ui.bubble) say(pick(PATS), { ttl: 4000, expr: 'happy', hop: true }); });
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  pill.addEventListener('click', pause);

  Shell.onTick(tick);
  Shell.onTray((id) => {
    if (id === 'open') openPanel();
    else if (id === 'focus') { S.timer.phase === 'idle' ? start('focus') : pause(); say(S.timer.phase === 'focus' && !S.timer.paused ? 'Focus started.' : 'Timer paused.', { ttl: 2500 }); }
    else if (id.startsWith('mode-')) setMode(id.slice(5));
  });

  face(); render();
  if (S.mode === 'walk') Shell.dock();
  window.Deskling = { S, ui, say, openPanel, tick }; // handy in the dev console
})();
