document.addEventListener('DOMContentLoaded', () => {

    // ─── State ───────────────────────────────────────────────────────────
    let state = { mode: 'solid', color: '#ff0000', brightness: 255, speed: 50 };

    // ─── Element refs ─────────────────────────────────────────────────────
    const colorPicker        = document.getElementById('color-picker');
    const colorHex           = document.getElementById('color-hex');
    const brightnessSlider   = document.getElementById('brightness-slider');
    const brightnessVal      = document.getElementById('brightness-val');
    const speedSlider        = document.getElementById('speed-slider');
    const speedVal           = document.getElementById('speed-val');
    const speedSection       = document.getElementById('speed-section');
    const colorSection       = document.getElementById('color-section');
    const modeBtns           = document.querySelectorAll('.mode-btn');
    const presetColors       = document.querySelectorAll('.preset-color');
    const previewOrb         = document.getElementById('preview-orb');
    const patternNameInput   = document.getElementById('pattern-name-input');
    const savePatternBtn     = document.getElementById('save-pattern-btn');
    const patternsList       = document.getElementById('patterns-list');
    const tabBtns            = document.querySelectorAll('.tab-btn');
    const tabContents        = document.querySelectorAll('.tab-content');

    const API_STATE    = '/api/state';
    const API_PATTERNS = '/api/patterns';

    // ─── Utilities ───────────────────────────────────────────────────────
    const debounce = (fn, ms) => {
        let t;
        return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
    };

    function showToast(msg) {
        const t = document.createElement('div');
        t.className = 'toast';
        t.textContent = msg;
        document.body.appendChild(t);
        requestAnimationFrame(() => { t.classList.add('show'); });
        setTimeout(() => {
            t.classList.remove('show');
            setTimeout(() => t.remove(), 400);
        }, 2200);
    }

    // ─── Active-state sync ────────────────────────────────────────────────
    const pushState = async () => {
        try {
            await fetch(API_STATE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(state)
            });
            updateOrb();
        } catch { /* silent fail; ESP will retry */ }
    };
    const debouncedPush = debounce(pushState, 150);

    const loadState = async () => {
        try {
            const res = await fetch(API_STATE);
            if (!res.ok) return;
            const data = await res.json();
            applyStateToUI(data);
        } catch { /* Pi might not be reachable yet */ }
    };

    function applyStateToUI(data) {
        state = data;
        colorPicker.value      = state.color;
        colorHex.textContent   = state.color.toUpperCase();
        brightnessSlider.value = state.brightness;
        brightnessVal.textContent = `${Math.round((state.brightness / 255) * 100)}%`;
        speedSlider.value      = state.speed;
        speedVal.textContent   = `${state.speed}%`;
        modeBtns.forEach(b => b.classList.toggle('active', b.dataset.mode === state.mode));
        updateOrb();
    }

    // ─── Orb & visibility helpers ────────────────────────────────────────
    function updateOrb() {
        if (state.mode === 'rainbow') {
            previewOrb.style.background  = 'conic-gradient(red, orange, yellow, green, cyan, blue, violet, red)';
            previewOrb.style.boxShadow   = '0 0 20px rgba(255,255,255,0.4)';
        } else {
            previewOrb.style.background  = state.color;
            previewOrb.style.boxShadow   = `0 0 24px ${state.color}`;
        }

        // Disable color picker for rainbow mode
        const rainbow = state.mode === 'rainbow';
        colorSection.style.opacity       = rainbow ? '0.4' : '1';
        colorSection.style.pointerEvents = rainbow ? 'none' : 'auto';

        // Show speed only for animated modes
        speedSection.style.display = (state.mode === 'solid') ? 'none' : 'block';
    }

    // ─── Tab navigation ──────────────────────────────────────────────────
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.tab;
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`tab-${target}`).classList.add('active');

            if (target === 'patterns') loadPatterns();
        });
    });

    // ─── Mode buttons ────────────────────────────────────────────────────
    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.mode = btn.dataset.mode;
            updateOrb();
            debouncedPush();
        });
    });

    // ─── Color picker ────────────────────────────────────────────────────
    colorPicker.addEventListener('input', e => {
        state.color = e.target.value;
        colorHex.textContent = state.color.toUpperCase();
        updateOrb();
        debouncedPush();
    });

    presetColors.forEach(p => {
        p.addEventListener('click', () => {
            state.color = p.dataset.color;
            colorPicker.value        = state.color;
            colorHex.textContent     = state.color.toUpperCase();
            updateOrb();
            debouncedPush();
        });
    });

    // ─── Sliders ─────────────────────────────────────────────────────────
    brightnessSlider.addEventListener('input', e => {
        state.brightness = parseInt(e.target.value);
        brightnessVal.textContent = `${Math.round((state.brightness / 255) * 100)}%`;
        debouncedPush();
    });

    speedSlider.addEventListener('input', e => {
        state.speed = parseInt(e.target.value);
        speedVal.textContent = `${state.speed}%`;
        debouncedPush();
    });

    // ─── Save current state as a pattern ─────────────────────────────────
    savePatternBtn.addEventListener('click', async () => {
        const name = patternNameInput.value.trim();
        if (!name) { showToast('⚠️ Enter a pattern name first'); return; }

        try {
            const res = await fetch(API_PATTERNS, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...state, name })
            });
            if (res.status === 409) { showToast('❌ Name already taken'); return; }
            if (!res.ok) throw new Error();
            patternNameInput.value = '';
            showToast(`✅ Saved "${name}"`);
        } catch {
            showToast('❌ Could not save pattern');
        }
    });

    // ─── Patterns list ────────────────────────────────────────────────────
    async function loadPatterns() {
        patternsList.innerHTML = '<p class="empty-msg">Loading…</p>';
        try {
            const res = await fetch(API_PATTERNS);
            const patterns = await res.json();
            renderPatterns(patterns);
        } catch {
            patternsList.innerHTML = '<p class="empty-msg">Could not load patterns.</p>';
        }
    }

    function renderPatterns(patterns) {
        if (!patterns.length) {
            patternsList.innerHTML = '<p class="empty-msg">No patterns saved yet.</p>';
            return;
        }

        patternsList.innerHTML = '';
        patterns.forEach(p => {
            const item = document.createElement('div');
            item.className = 'pattern-item';
            item.innerHTML = `
                <div class="pattern-swatch" style="background:${p.mode === 'rainbow'
                    ? 'conic-gradient(red,orange,yellow,green,cyan,blue,violet,red)'
                    : p.color}; box-shadow: 0 0 10px ${p.mode === 'rainbow' ? 'rgba(255,255,255,0.3)' : p.color}"></div>
                <div class="pattern-info">
                    <div class="pattern-name">${escapeHtml(p.name)}</div>
                    <div class="pattern-meta">${p.mode} · ${Math.round((p.brightness/255)*100)}% · ${p.color.toUpperCase()}</div>
                </div>
                <div class="pattern-actions">
                    <button class="icon-btn play" title="Activate" data-id="${p.id}"><i class="fa-solid fa-play"></i></button>
                    <button class="icon-btn del"  title="Delete"   data-id="${p.id}"><i class="fa-solid fa-trash"></i></button>
                </div>`;
            patternsList.appendChild(item);
        });

        // Activate
        patternsList.querySelectorAll('.icon-btn.play').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                try {
                    const res = await fetch(`${API_PATTERNS}/${id}/activate`, { method: 'POST' });
                    const newState = await res.json();
                    applyStateToUI(newState);
                    showToast('✅ Pattern activated');
                    // Switch to control tab
                    tabBtns[0].click();
                } catch {
                    showToast('❌ Could not activate');
                }
            });
        });

        // Delete
        patternsList.querySelectorAll('.icon-btn.del').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                try {
                    await fetch(`${API_PATTERNS}/${id}`, { method: 'DELETE' });
                    showToast('🗑️ Pattern deleted');
                    loadPatterns();
                } catch {
                    showToast('❌ Could not delete');
                }
            });
        });
    }

    function escapeHtml(str) {
        const d = document.createElement('div');
        d.appendChild(document.createTextNode(str));
        return d.innerHTML;
    }

    // ─── Init ─────────────────────────────────────────────────────────────
    loadState();
    // Sync from DB every 5 s (to reflect changes from other devices)
    setInterval(loadState, 5000);

    // CSS keyframes injected at runtime for the orb
    const sheet = document.createElement('style');
    sheet.textContent = `
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes pulse-orb {
            0%   { transform: scale(1);   opacity: 1; }
            50%  { transform: scale(0.9); opacity: 0.7; }
            100% { transform: scale(1);   opacity: 1; }
        }
    `;
    document.head.appendChild(sheet);
});
