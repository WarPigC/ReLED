document.addEventListener('DOMContentLoaded', () => {
    let state = {
        mode: 'solid',
        color: '#ff0000',
        brightness: 255,
        speed: 50
    };

    const colorPicker = document.getElementById('color-picker');
    const colorHex = document.getElementById('color-hex');
    const brightnessSlider = document.getElementById('brightness-slider');
    const brightnessVal = document.getElementById('brightness-val');
    const speedSlider = document.getElementById('speed-slider');
    const speedVal = document.getElementById('speed-val');
    const speedSection = document.getElementById('speed-section');
    const colorSection = document.getElementById('color-section');
    const modeBtns = document.querySelectorAll('.mode-btn');
    const presetColors = document.querySelectorAll('.preset-color');
    const previewOrb = document.getElementById('preview-orb');
    
    const API_URL = '/api/state';

    const debounce = (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    };

    const pushState = async () => {
        try {
            await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(state)
            });
            updateOrb();
        } catch (error) {
            console.error('Failed to sync state:', error);
        }
    };
    
    const debouncedPushState = debounce(pushState, 150);

    const updateOrb = () => {
        if (state.mode === 'solid') {
            previewOrb.style.background = state.color;
            previewOrb.style.boxShadow = `0 0 20px ${state.color}`;
            previewOrb.style.animation = 'none';
        } else if (state.mode === 'rainbow') {
            previewOrb.style.background = 'linear-gradient(45deg, red, orange, yellow, green, blue, indigo, violet)';
            previewOrb.style.boxShadow = '0 0 20px rgba(255,255,255,0.5)';
            previewOrb.style.animation = 'spin 3s linear infinite';
        } else {
            previewOrb.style.background = state.color;
            previewOrb.style.boxShadow = `0 0 20px ${state.color}`;
            previewOrb.style.animation = 'pulse-orb 2s infinite';
        }
        
        if (['rainbow'].includes(state.mode)) {
            colorSection.style.opacity = '0.5';
            colorSection.style.pointerEvents = 'none';
        } else {
            colorSection.style.opacity = '1';
            colorSection.style.pointerEvents = 'auto';
        }

        if (['solid'].includes(state.mode)) {
            speedSection.style.display = 'none';
        } else {
            speedSection.style.display = 'block';
        }
    };

    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.mode = btn.dataset.mode;
            debouncedPushState();
            updateOrb();
        });
    });

    colorPicker.addEventListener('input', (e) => {
        state.color = e.target.value;
        colorHex.textContent = state.color.toUpperCase();
        updateOrb();
        debouncedPushState();
    });

    presetColors.forEach(preset => {
        preset.addEventListener('click', () => {
            const newColor = preset.dataset.color;
            colorPicker.value = newColor;
            state.color = newColor;
            colorHex.textContent = newColor.toUpperCase();
            updateOrb();
            debouncedPushState();
        });
    });

    brightnessSlider.addEventListener('input', (e) => {
        const val = e.target.value;
        const percent = Math.round((val / 255) * 100);
        brightnessVal.textContent = `${percent}%`;
        state.brightness = parseInt(val);
        debouncedPushState();
    });

    speedSlider.addEventListener('input', (e) => {
        state.speed = parseInt(e.target.value);
        speedVal.textContent = `${state.speed}%`;
        debouncedPushState();
    });

    const loadState = async () => {
        try {
            const res = await fetch(API_URL);
            if(res.ok) {
                const data = await res.json();
                state = data;
                
                colorPicker.value = state.color;
                colorHex.textContent = state.color.toUpperCase();
                
                brightnessSlider.value = state.brightness;
                brightnessVal.textContent = `${Math.round((state.brightness / 255) * 100)}%`;
                
                speedSlider.value = state.speed;
                speedVal.textContent = `${state.speed}%`;
                
                modeBtns.forEach(b => {
                    b.classList.toggle('active', b.dataset.mode === state.mode);
                });
                
                updateOrb();
            }
        } catch (error) {
            console.error("Could not load initial state");
        }
    };

    loadState();
    setInterval(loadState, 5000);

    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes pulse-orb {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(0.9); opacity: 0.7; }
            100% { transform: scale(1); opacity: 1; }
        }
    `;
    document.head.appendChild(styleSheet);
});
