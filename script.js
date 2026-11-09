(() => {
  'use strict';

  const slides = [...document.querySelectorAll('.slide')];
  const total = slides.length;
  const last = total - 1;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const STORE_KEY = 'apology_response_v1';
  const ENDPOINT = '/api/respond';

  let index = 0;
  let selected = null;
  let sending = false;

  // ---------- progress dots ----------
  const progress = document.getElementById('progress');
  slides.forEach(() => progress.appendChild(document.createElement('i')));
  const dots = [...progress.children];

  // ---------- toast ----------
  const toastEl = document.getElementById('toast');
  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3200);
  }

  // ---------- navigation ----------
  function goTo(i) {
    if (i < 0 || i > last || i === index) return;
    const prev = slides[index];
    prev.classList.remove('active');
    prev.classList.toggle('out-left', i > index);
    index = i;
    const cur = slides[index];
    cur.classList.remove('out-left');
    cur.classList.add('active');
    cur.scrollTop = 0;
    dots.forEach((d, n) => d.classList.toggle('on', n === index));
    if (index === last) restoreIfAnswered();
  }

  document.addEventListener('click', (e) => {
    const next = e.target.closest('[data-next]');
    const prev = e.target.closest('[data-prev]');
    if (next) {
      if (index === 0) startMusicGently();
      goTo(index + 1);
    } else if (prev) {
      goTo(index - 1);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.target.matches('textarea,input')) return;
    if (e.key === 'ArrowRight') goTo(index + 1 > last ? index : index + 1);
    if (e.key === 'ArrowLeft') goTo(index - 1);
  });

  // swipe (only on slides without the final question, so she never swipes into an answer by accident)
  let tx = null, ty = null;
  document.addEventListener('touchstart', (e) => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (tx === null) return;
    const dx = e.changedTouches[0].clientX - tx;
    const dy = e.changedTouches[0].clientY - ty;
    tx = ty = null;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (e.target.closest('textarea')) return;
    if (dx < 0 && index > 0 && index < last) goTo(index + 1);
    else if (dx > 0) goTo(index - 1);
  }, { passive: true });

  // ---------- music ----------
  const song = document.getElementById('song');
  const musicBtn = document.getElementById('musicBtn');
  const muteBtn = document.getElementById('muteBtn');
  song.volume = 0.45;
  let musicMissing = false;

  song.addEventListener('error', () => { musicMissing = true; });
  song.addEventListener('play', () => { musicBtn.classList.add('playing'); musicBtn.classList.remove('pulse-hint'); musicBtn.setAttribute('aria-label', 'Pause music'); });
  song.addEventListener('pause', () => { musicBtn.classList.remove('playing'); musicBtn.setAttribute('aria-label', 'Play music'); });

  async function playSong(showErrors) {
    if (musicMissing) { if (showErrors) toast('The song file is missing. See the README.'); return; }
    try {
      await song.play();
    } catch (err) {
      if (showErrors) toast(musicMissing || err.name === 'NotSupportedError' ? 'The song file is missing. See the README.' : 'Tap the music button to start our song 🎵');
    }
  }

  // Starts only from a real tap (never autoplay). If the browser still refuses, the button pulses.
  function startMusicGently() {
    if (!song.paused) return;
    playSong(false).then(() => { if (song.paused) musicBtn.classList.add('pulse-hint'); });
  }

  musicBtn.addEventListener('click', () => { song.paused ? playSong(true) : song.pause(); });
  muteBtn.addEventListener('click', () => {
    song.muted = !song.muted;
    muteBtn.classList.toggle('muted', song.muted);
    muteBtn.setAttribute('aria-label', song.muted ? 'Unmute music' : 'Mute music');
  });
  // show a gentle hint on the very first screen
  setTimeout(() => { if (song.paused && !musicMissing) musicBtn.classList.add('pulse-hint'); }, 1200);

  // ---------- floating hearts ----------
  const heartsEl = document.getElementById('hearts');
  const glyphs = ['❤', '♡', '❥', '💗', '💕'];
  function spawnHeart() {
    if (document.hidden || reduceMotion) return;
    const h = document.createElement('span');
    h.className = 'fh';
    h.textContent = glyphs[Math.floor(Math.random() * glyphs.length)];
    const size = 12 + Math.random() * 18;
    h.style.left = Math.random() * 100 + 'vw';
    h.style.fontSize = size + 'px';
    h.style.color = ['#ffb3cf', '#ff8fb3', '#d6c2f0', '#ffc4d8'][Math.floor(Math.random() * 4)];
    h.style.setProperty('--dx', (Math.random() * 80 - 40) + 'px');
    const dur = 9 + Math.random() * 7;
    h.style.animationDuration = dur + 's';
    heartsEl.appendChild(h);
    setTimeout(() => h.remove(), dur * 1000 + 200);
  }
  setInterval(() => { if (heartsEl.childElementCount < 14) spawnHeart(); }, 1300);

  // ---------- final question ----------
  const askView = document.getElementById('askView');
  const confirmView = document.getElementById('confirmView');
  const doneView = document.getElementById('doneView');
  const noteEl = document.getElementById('note');
  const errorEl = document.getElementById('errorMsg');
  const sendBtn = document.getElementById('sendBtn');
  const changeBtn = document.getElementById('changeBtn');

  const copy = {
    YES: {
      confirmTitle: 'Thank you for choosing this ❤️',
      confirmText: 'You picked YES. Before I send it to me, is there anything you want to say?',
      doneTitle: 'Thank you. Truly. ❤️',
      doneText: "Thank you for giving us another chance. I won't take it for granted. I'll show you, not just tell you, with patience, honesty and consistency."
    },
    NO: {
      confirmTitle: 'Thank you for being honest',
      confirmText: "You picked NO. That's completely okay. Before I send it to me, is there anything you want to say?",
      doneTitle: 'Thank you for telling me.',
      doneText: "I respect your decision, and I'm grateful you answered from your heart. I'm sorry again for the hurt, and I wish you all the happiness and peace you deserve."
    }
  };

  function show(view) {
    askView.hidden = view !== 'ask';
    confirmView.hidden = view !== 'confirm';
    doneView.hidden = view !== 'done';
    slides[last].scrollTop = 0;
  }

  function makeToken() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12);
  }

  function readSaved() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch { return null; }
  }
  function writeSaved(obj) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(obj)); } catch { /* private mode etc. */ }
  }

  function renderDone(answer) {
    document.getElementById('doneTitle').textContent = copy[answer].doneTitle;
    document.getElementById('doneText').textContent = copy[answer].doneText;
    show('done');
  }

  function restoreIfAnswered() {
    const saved = readSaved();
    if (saved && saved.sent) renderDone(saved.answer);
  }

  document.querySelectorAll('[data-answer]').forEach((btn) => {
    btn.addEventListener('click', () => {
      selected = btn.dataset.answer;
      document.getElementById('confirmTitle').textContent = copy[selected].confirmTitle;
      document.getElementById('confirmText').textContent = copy[selected].confirmText;
      errorEl.hidden = true;
      show('confirm');
      noteEl.focus({ preventScroll: true });
    });
  });

  changeBtn.addEventListener('click', () => { if (!sending) { selected = null; show('ask'); } });

  sendBtn.addEventListener('click', async () => {
    if (sending || !selected) return;
    const saved = readSaved();
    if (saved && saved.sent) { renderDone(saved.answer); return; }

    // The token stays the same across retries, so the server can ignore duplicates.
    const token = (saved && saved.token) || makeToken();
    writeSaved({ token, answer: selected, sent: false });

    sending = true;
    sendBtn.disabled = changeBtn.disabled = true;
    sendBtn.textContent = 'Sending…';
    errorEl.hidden = true;

    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answer: selected,
          message: noteEl.value.trim(),
          token,
          website: document.getElementById('website').value
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || 'Request failed');
      writeSaved({ token, answer: selected, sent: true });
      renderDone(selected);
    } catch (err) {
      errorEl.textContent = "Sorry, your answer didn't go through. Please check your connection and try again. Nothing was lost.";
      errorEl.hidden = false;
    } finally {
      sending = false;
      sendBtn.disabled = changeBtn.disabled = false;
      sendBtn.textContent = 'Send my answer';
    }
  });

  dots[0].classList.add('on');
})();
