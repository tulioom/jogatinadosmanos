(() => {
  'use strict';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function configureTheme() {
    const button = document.getElementById('themeToggle');
    const label = button.querySelector('.theme-label');
    const icon = button.querySelector('.theme-icon');
    let preferred = 'dark';
    try { preferred = localStorage.getItem('manos-theme') || 'dark'; } catch (_) {}
    root.dataset.theme = preferred;
    const drawLabel = () => {
      const light = root.dataset.theme === 'light';
      label.textContent = light ? 'tema escuro' : 'tema claro';
      icon.textContent = light ? '☾' : '☼';
      button.setAttribute('aria-pressed', String(light));
      document.querySelector('meta[name="theme-color"]').content = light ? '#f4f1eb' : '#0d111b';
    };
    drawLabel();
    button.addEventListener('click', () => {
      root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('manos-theme', root.dataset.theme); } catch (_) {}
      drawLabel();
    });
  }

  function createArchive() {
    const chaptersRoot = document.getElementById('chapters');
    const index = document.getElementById('chapterIndex');
    const allChapters = window.JOGATINA_STORY || [];
    const indexTitle = document.createElement('p');
    indexTitle.className = 'chapter-index-label';
    indexTitle.textContent = 'Escolha por onde começar · os capítulos abrem quando você quiser';
    index.append(indexTitle);
    const archive = document.createDocumentFragment();

    const addText = (tag, className, value, parent) => {
      const element = document.createElement(tag);
      if (className) element.className = className;
      element.textContent = value;
      parent.append(element);
      return element;
    };

    allChapters.forEach((chapter) => {
      const link = document.createElement('a');
      link.href = `#${chapter.id}`;
      link.textContent = String(chapter.number).padStart(2, '0');
      link.setAttribute('aria-label', `Capítulo ${chapter.number}: ${chapter.title}`);
      link.title = chapter.title;
      index.append(link);

      const details = document.createElement('details');
      details.className = 'chapter reveal';
      details.id = chapter.id;
      const summary = document.createElement('summary');
      const number = addText('span', 'chapter-number', String(chapter.number).padStart(2, '0'), summary);
      number.setAttribute('aria-hidden', 'true');
      const copy = document.createElement('span');
      copy.className = 'chapter-summary-copy';
      addText('span', 'chapter-kicker', `capítulo ${String(chapter.number).padStart(2, '0')} · registro de equipe`, copy);
      addText('span', 'chapter-title', chapter.title, copy);
      addText('span', 'chapter-subtitle', chapter.subtitle, copy);
      summary.append(copy);
      summary.setAttribute('aria-label', `Abrir capítulo ${chapter.number}: ${chapter.title}`);
      details.append(summary);

      const content = document.createElement('div');
      content.className = 'chapter-content';
      addText('p', 'chapter-summary-text', chapter.summary, content);
      const scenes = document.createElement('div');
      scenes.className = 'scene-list';
      scenes.setAttribute('aria-label', `Registros do capítulo ${chapter.number}`);

      chapter.scenes.forEach((scene, sceneIndex) => {
        const entry = document.createElement('details');
        entry.className = 'scene-card';
        const entrySummary = document.createElement('summary');
        addText('span', 'entry-numeral', String(sceneIndex + 1).padStart(2, '0'), entrySummary).setAttribute('aria-hidden', 'true');
        const sceneLabel = document.createElement('span');
        sceneLabel.className = 'scene-copy';
        addText('span', 'scene-heading', scene.heading.replace(/^\d{2}\.\s*/, ''), sceneLabel);
        addText('span', 'scene-marker', scene.marker, sceneLabel);
        entrySummary.append(sceneLabel);
        entrySummary.setAttribute('aria-label', `Abrir registro ${scene.heading}`);
        entry.append(entrySummary);

        const body = document.createElement('div');
        body.className = 'scene-body';
        addText('p', 'scene-speaker', `${scene.speaker} · na escuta`, body);
        scene.paragraphs.forEach((paragraph) => addText('p', '', paragraph, body));
        const memory = document.createElement('div');
        memory.className = 'scene-memory';
        addText('span', 'memory-label', 'LEMBRANÇA', memory);
        addText('span', '', scene.keepsake, memory);
        body.append(memory);
        const sound = document.createElement('div');
        sound.className = 'scene-sound';
        addText('span', '', '♫', sound).setAttribute('aria-hidden', 'true');
        addText('span', '', scene.soundCue, sound);
        body.append(sound);
        addText('div', 'scene-terminal', scene.terminal, body);
        entry.append(body);
        scenes.append(entry);
      });

      content.append(scenes);
      addText('span', 'story-coda', `${chapter.scenes.length} registros · lembranças guardadas sem placar`, content);
      details.append(content);
      details.addEventListener('toggle', () => {
        if (details.open && window.innerWidth < 680) {
          window.setTimeout(() => details.scrollIntoView({ behavior: reduceMotion ? 'instant' : 'smooth', block: 'start' }), 40);
        }
      });
      archive.append(details);
    });
    chaptersRoot.classList.add('chapters-list');
    chaptersRoot.append(archive);
    index.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
      const target = document.getElementById(link.hash.slice(1));
      if (target) target.open = true;
    }));
    return { allChapters, index };
  }

  function configureTerminal(chapterData) {
    const output = document.getElementById('terminalOutput');
    const form = document.getElementById('terminalForm');
    const input = document.getElementById('terminalCommand');
    const quickCommands = document.querySelector('.terminal-chips');
    const terminalHistory = [];
    let historyPointer = 0;
    let typingTimer = 0;
    let lastIntroLines = [];
    const greetings = [
      ['dim', 'ARQUIVO DE MEMÓRIA / JOGATINA DOS MANOS'],
      ['plain', 'Três vozes registradas: Miguel · Renan · Túlio.'],
      ['plain', 'A cadeira do Silício continua reservada.'],
      ['dim', 'Digite “ajuda” para conhecer os comandos.']
    ];

    const appendLine = (kind, message) => {
      const row = document.createElement('p');
      row.className = `terminal-line${kind === 'error' ? ' error' : ''}`;
      if (kind === 'input') {
        const prompt = document.createElement('span');
        prompt.className = 'prompt';
        prompt.textContent = '› ';
        row.append(prompt, document.createTextNode(message));
      } else {
        const line = document.createElement('span');
        line.className = kind === 'dim' || kind === 'accent' ? kind : '';
        line.textContent = message;
        row.append(line);
      }
      output.append(row);
      while (output.children.length > 32) output.firstElementChild.remove();
      output.scrollTop = output.scrollHeight;
    };

    const bootTerminal = () => {
      window.clearInterval(typingTimer);
      output.replaceChildren();
      let rowIndex = 0;
      let charIndex = 0;
      let current;
      const step = () => {
        if (rowIndex >= greetings.length) {
          window.clearInterval(typingTimer);
          typingTimer = 0;
          return;
        }
        if (charIndex === 0) {
          current = document.createElement('p');
          current.className = `terminal-line${greetings[rowIndex][0] === 'error' ? ' error' : ''}`;
          const span = document.createElement('span');
          span.className = greetings[rowIndex][0] === 'plain' ? '' : greetings[rowIndex][0];
          current.append(span);
          output.append(current);
          lastIntroLines.push(current);
        }
        const target = current.firstElementChild;
        target.textContent += greetings[rowIndex][1].charAt(charIndex);
        charIndex += 1;
        output.scrollTop = output.scrollHeight;
        if (charIndex >= greetings[rowIndex][1].length) {
          rowIndex += 1;
          charIndex = 0;
        }
      };
      if (reduceMotion) {
        greetings.forEach(([kind, message]) => appendLine(kind, message));
      } else {
        typingTimer = window.setInterval(step, 20);
      }
    };

    const runCommand = (rawCommand) => {
      const raw = rawCommand.trim();
      if (!raw) return;
      if (terminalHistory[terminalHistory.length - 1] !== raw) terminalHistory.push(raw);
      historyPointer = terminalHistory.length;
      appendLine('input', raw);
      const command = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const answers = {
        ajuda: ['accent', 'comandos: equipe · memoria · mapa · status · voltar · ajuda'],
        equipe: ['plain', 'Rato de Touca = Miguel. Silício = Renan. Holy = Túlio.'],
        memoria: ['plain', '150 cenas guardadas. O placar nunca contou a história toda.'],
        mapa: ['plain', `${chapterData.length} capítulos. De “bora?” até “que bom que você chegou”.`],
        status: ['accent', 'call aberta · cadeira do Silício reservada · convite sem prazo'],
        voltar: ['plain', 'Renan, quando você quiser. Nem precisa escolher o jogo antes.'],
        clear: ['clear', ''],
        limpar: ['clear', '']
      };
      const result = answers[command];
      if (!result) {
        appendLine('error', `comando “${raw}” não encontrado. Tenta “ajuda”.`);
      } else if (result[0] === 'clear') {
        output.replaceChildren();
        appendLine('dim', 'arquivo limpo · as lembranças continuam guardadas.');
      } else {
        appendLine(result[0], result[1]);
      }
    };

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      runCommand(input.value);
      input.value = '';
    });
    quickCommands.addEventListener('click', (event) => {
      const button = event.target.closest('[data-command]');
      if (!button) return;
      input.value = button.dataset.command;
      runCommand(input.value);
      input.value = '';
      input.focus();
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        historyPointer = Math.max(0, historyPointer - 1);
        input.value = terminalHistory[historyPointer] || '';
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        historyPointer = Math.min(terminalHistory.length, historyPointer + 1);
        input.value = terminalHistory[historyPointer] || '';
      }
    });
    bootTerminal();
  }

  function configureReveal() {
    const reveals = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window) || reduceMotion) {
      reveals.forEach((element) => element.classList.add('is-revealed'));
      return;
    }
    const observer = new IntersectionObserver((entries, activeObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-revealed');
        activeObserver.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -44px 0px', threshold: 0.04 });
    reveals.forEach((element) => observer.observe(element));
  }

  function configureNameReveal() {
    const target = document.getElementById('scrambleName');
    if (!target || reduceMotion) return;
    const finalText = 'MANOS';
    const alphabet = '▓▒░<>{}*+=#?ABCDEFGHJKLMNPQRSTUVWXYZ';
    let frame = 0;
    const totalFrames = 26;
    target.setAttribute('aria-label', finalText.toLowerCase());
    const timer = window.setInterval(() => {
      const settled = Math.floor((frame / totalFrames) * finalText.length);
      const text = finalText.split('').map((letter, index) => {
        if (index < settled) return letter;
        return alphabet[Math.floor(Math.random() * alphabet.length)];
      }).join('');
      target.textContent = text;
      frame += 1;
      if (frame > totalFrames) {
        window.clearInterval(timer);
        target.textContent = finalText;
      }
    }, 68);
  }

  function configureTimeCounter() {
    const counter = document.getElementById('timeCounter');
    const start = Date.now();
    const update = () => {
      const seconds = Math.floor((Date.now() - start) / 1000);
      counter.textContent = String(seconds);
      counter.parentElement.setAttribute('aria-label', `Você está aqui há ${seconds} segundos`);
    };
    update();
    window.setInterval(update, 1000);
  }

  function configureReadProgress() {
    const bar = document.getElementById('readingBar');
    let queued = false;
    const update = () => {
      const available = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = available > 0 ? clamp(window.scrollY / available, 0, 1) : 0;
      bar.style.width = `${ratio * 100}%`;
      queued = false;
    };
    const requestUpdate = () => {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(update);
    };
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate, { passive: true });
    update();
  }

  function configureCursorAndLight() {
    const glow = document.getElementById('pointerGlow');
    const cursor = document.getElementById('customCursor');
    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    let pointer = null;
    let glowX = 0;
    let glowY = 0;
    let frame = 0;
    const place = (event) => {
      pointer = { x: event.clientX, y: event.clientY };
      if (!frame) frame = window.requestAnimationFrame(draw);
    };
    const draw = () => {
      frame = 0;
      if (!pointer) return;
      glowX += (pointer.x - glowX) * .24;
      glowY += (pointer.y - glowY) * .24;
      glow.style.left = `${glowX}px`;
      glow.style.top = `${glowY}px`;
      cursor.style.left = `${pointer.x}px`;
      cursor.style.top = `${pointer.y}px`;
      if (Math.abs(pointer.x - glowX) + Math.abs(pointer.y - glowY) > 1.5) frame = window.requestAnimationFrame(draw);
    };
    if (canHover && !reduceMotion) {
      window.addEventListener('pointermove', place, { passive: true });
      window.addEventListener('pointerover', (event) => {
        if (!event.target.closest('a,button,summary,[tabindex="0"]')) return;
        cursor.classList.add('is-hovering');
      }, { passive: true });
      window.addEventListener('pointerout', (event) => {
        if (!event.target.closest('a,button,summary,[tabindex="0"]')) return;
        cursor.classList.remove('is-hovering');
      }, { passive: true });
    }
    window.addEventListener('pointerdown', (event) => {
      pointer = { x: event.clientX, y: event.clientY };
      glowX = pointer.x;
      glowY = pointer.y;
      glow.style.left = `${glowX}px`;
      glow.style.top = `${glowY}px`;
      glow.classList.add('is-visible');
      if (canHover) {
        cursor.classList.add('is-visible');
        cursor.style.left = `${pointer.x}px`;
        cursor.style.top = `${pointer.y}px`;
      }
      window.clearTimeout(glow._hideTimer);
      if (!canHover) glow._hideTimer = window.setTimeout(() => glow.classList.remove('is-visible'), 1100);
    }, { passive: true });
    if (canHover) {
      window.addEventListener('pointerenter', () => { glow.classList.add('is-visible'); cursor.classList.add('is-visible'); });
      window.addEventListener('pointerleave', () => { glow.classList.remove('is-visible'); cursor.classList.remove('is-visible'); });
    }
  }

  function configureConstellation() {
    const canvas = document.getElementById('constellation');
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const count = window.innerWidth < 600 ? 32 : 58;
    const points = [];
    const influenceRadius = window.innerWidth < 600 ? 116 : 150;
    let pointer = null;
    let width = 0;
    let height = 0;
    let animation = 0;
    let lastDraw = 0;
    for (let i = 0; i < count; i += 1) {
      points.push({ x: Math.random(), y: Math.random(), dx: (Math.random() - .5) * .000055, dy: (Math.random() - .5) * .000055, r: Math.random() * 1.3 + .5 });
    }
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    const draw = (time = 0) => {
      animation = 0;
      if (!reduceMotion && time - lastDraw < 38) {
        animation = window.requestAnimationFrame(draw);
        return;
      }
      lastDraw = time;
      context.clearRect(0, 0, width, height);
      const themeLight = root.dataset.theme === 'light';
      const rgb = themeLight ? '89,94,111' : '188,199,219';
      points.forEach((point, index) => {
        if (!reduceMotion) {
          point.x += point.dx;
          point.y += point.dy;
          if (point.x < 0 || point.x > 1) point.dx *= -1;
          if (point.y < 0 || point.y > 1) point.dy *= -1;
        }
        const x = point.x * width;
        const y = point.y * height;
        context.beginPath();
        context.arc(x, y, point.r, 0, Math.PI * 2);
        context.fillStyle = `rgba(${rgb},.37)`;
        context.fill();
        for (let next = index + 1; next < points.length; next += 1) {
          const other = points[next];
          const ox = other.x * width;
          const oy = other.y * height;
          const distance = Math.hypot(x - ox, y - oy);
          const normalRadius = width < 600 ? 88 : 116;
          if (distance < normalRadius) {
            context.beginPath();
            context.moveTo(x, y);
            context.lineTo(ox, oy);
            context.strokeStyle = `rgba(${rgb},${(1 - distance / normalRadius) * .095})`;
            context.lineWidth = .65;
            context.stroke();
          }
        }
        if (pointer) {
          const distance = Math.hypot(x - pointer.x, y - pointer.y);
          if (distance < influenceRadius) {
            context.beginPath();
            context.moveTo(x, y);
            context.lineTo(pointer.x, pointer.y);
            context.strokeStyle = `rgba(${themeLight ? '150,96,19' : '240,188,105'},${(1 - distance / influenceRadius) * .34})`;
            context.lineWidth = .75;
            context.stroke();
          }
        }
      });
      if (!reduceMotion) animation = window.requestAnimationFrame(draw);
    };
    resize();
    draw();
    window.addEventListener('resize', () => { resize(); if (!animation) draw(); }, { passive: true });
    if (finePointer) {
      window.addEventListener('pointermove', (event) => { pointer = { x: event.clientX, y: event.clientY }; if (!animation) animation = window.requestAnimationFrame(draw); }, { passive: true });
      window.addEventListener('pointerleave', () => { pointer = null; if (!animation) animation = window.requestAnimationFrame(draw); });
    } else {
      window.addEventListener('pointerdown', (event) => { pointer = { x: event.clientX, y: event.clientY }; if (!animation) animation = window.requestAnimationFrame(draw); }, { passive: true });
      window.addEventListener('pointerup', () => { pointer = null; }, { passive: true });
      window.addEventListener('pointercancel', () => { pointer = null; }, { passive: true });
    }
  }

  function configureTilt() {
    const card = document.querySelector('.hero-card');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!card || !finePointer || reduceMotion) return;
    const reset = () => { card.style.transform = 'rotateX(0deg) rotateY(0deg)'; };
    card.addEventListener('pointermove', (event) => {
      const box = card.getBoundingClientRect();
      const x = (event.clientX - box.left) / box.width;
      const y = (event.clientY - box.top) / box.height;
      card.style.transform = `rotateX(${(0.5 - y) * 5}deg) rotateY(${(x - 0.5) * 7}deg)`;
    });
    card.addEventListener('pointerleave', reset);
    card.addEventListener('blur', reset, true);
  }

  function configureChapterProgress(archive) {
    if (!('IntersectionObserver' in window)) return;
    const links = new Map();
    archive.index.querySelectorAll('a').forEach((link) => links.set(link.hash.slice(1), link));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          archive.index.querySelectorAll('a[aria-current="location"]').forEach((link) => link.removeAttribute('aria-current'));
          links.get(entry.target.id)?.setAttribute('aria-current', 'location');
        }
      });
    }, { rootMargin: '-12% 0px -78% 0px', threshold: 0 });
    archive.allChapters.forEach((chapter) => {
      const element = document.getElementById(chapter.id);
      if (element) observer.observe(element);
    });
  }

  function boot() {
    configureTheme();
    const archive = createArchive();
    configureTerminal(archive.allChapters);
    configureReveal();
    configureNameReveal();
    configureTimeCounter();
    configureReadProgress();
    configureCursorAndLight();
    configureConstellation();
    configureTilt();
    configureChapterProgress(archive);
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
