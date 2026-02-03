document.addEventListener("DOMContentLoaded", function (event) {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  const globalGain = audioCtx.createGain();
  globalGain.gain.setValueAtTime(0.2, audioCtx.currentTime);
  globalGain.connect(audioCtx.destination);

  const waveformSelect = document.getElementById("waveform");
  const visualKeyboard = document.getElementById("visual-keyboard");

  // Keys => Frequencies Map
  const keyData = [
    { code: "90", label: "Z", note: "C", freq: 261.63, type: "white" },
    { code: "83", label: "S", note: "C#", freq: 277.18, type: "black" },
    { code: "88", label: "X", note: "D", freq: 293.66, type: "white" },
    { code: "68", label: "D", note: "D#", freq: 311.13, type: "black" },
    { code: "67", label: "C", note: "E", freq: 329.63, type: "white" },
    { code: "86", label: "V", note: "F", freq: 349.23, type: "white" },
    { code: "71", label: "G", note: "F#", freq: 370.0, type: "black" },
    { code: "66", label: "B", note: "G", freq: 392.0, type: "white" },
    { code: "72", label: "H", note: "G#", freq: 415.3, type: "black" },
    { code: "78", label: "N", note: "A", freq: 440.0, type: "white" },
    { code: "74", label: "J", note: "A#", freq: 466.16, type: "black" },
    { code: "77", label: "M", note: "B", freq: 493.88, type: "white" },
    { code: "81", label: "Q", note: "C", freq: 523.25, type: "white" },
    { code: "50", label: "2", note: "C#", freq: 554.37, type: "black" },
    { code: "87", label: "W", note: "D", freq: 587.33, type: "white" },
    { code: "51", label: "3", note: "D#", freq: 622.25, type: "black" },
    { code: "69", label: "E", note: "E", freq: 659.26, type: "white" },
    { code: "82", label: "R", note: "F", freq: 698.46, type: "white" },
    { code: "53", label: "5", note: "F#", freq: 740.0, type: "black" },
    { code: "84", label: "T", note: "G", freq: 784.0, type: "white" },
    { code: "54", label: "6", note: "G#", freq: 830.61, type: "black" },
    { code: "89", label: "Y", note: "A", freq: 880.0, type: "white" },
    { code: "55", label: "7", note: "A#", freq: 932.33, type: "black" },
    { code: "85", label: "U", note: "B", freq: 987.77, type: "white" },
  ];

  // Build the frequency map from keyData for O(1) access
  const keyboardFrequencyMap = {};
  keyData.forEach((k) => {
    keyboardFrequencyMap[k.code] = k.freq;
  });

  // Visual keyboard
  function generateKeyboard() {
    visualKeyboard.innerHTML = "";
    keyData.forEach((key) => {
      const keyEl = document.createElement("div");
      keyEl.className = `key ${key.type}`;
      keyEl.dataset.key = key.code;
      keyEl.innerHTML = `<span>${key.note}</span><span class="key-label">${key.label}</span>`;

      // Mouse interaction
      keyEl.addEventListener("mousedown", () => {
        if (audioCtx.state === "suspended") audioCtx.resume();
        if (!activeOscillators[key.code]) {
          playNote(key.code);
          triggerVisual(key.code, true);
        }
      });
      keyEl.addEventListener("mouseup", () => stopNoteWithVisual(key.code));
      keyEl.addEventListener("mouseleave", () => stopNoteWithVisual(key.code));

      visualKeyboard.appendChild(keyEl);
    });
  }

  function stopNoteWithVisual(keyCode) {
    if (activeOscillators[keyCode]) {
      stopNote(keyCode);
      triggerVisual(keyCode, false);
    }
  }

  generateKeyboard();

  // Store active oscillators and their gain nodes
  // Structure: { key: { osc: OscillatorNode, gain: GainNode } }
  const activeOscillators = {};

  window.addEventListener("keydown", keyDown, false);
  window.addEventListener("keyup", keyUp, false);

  function keyDown(event) {
    // Resume audio context if suspended
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }

    const key = (event.detail || event.which).toString();

    // Prevent repeating keys
    if (keyboardFrequencyMap[key] && !activeOscillators[key]) {
      playNote(key);
      triggerVisual(key, true);
    }
  }

  function keyUp(event) {
    const key = (event.detail || event.which).toString();
    if (keyboardFrequencyMap[key] && activeOscillators[key]) {
      stopNote(key);
      triggerVisual(key, false);
    }
  }

  function playNote(key) {
    const osc = audioCtx.createOscillator();
    const noteGain = audioCtx.createGain();

    const frequency = keyboardFrequencyMap[key];
    osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);

    const waveform = waveformSelect.value;
    osc.type = waveform;

    // ADSR Envelope parameters
    const attackTime = 0.05;
    const decayTime = 0.1;
    const sustainLevel = 0.7;

    // Connect: Osc -> NoteGain -> GlobalGain -> Destination
    osc.connect(noteGain);
    noteGain.connect(globalGain);

    // Attack phase
    noteGain.gain.setValueAtTime(0, audioCtx.currentTime);
    noteGain.gain.linearRampToValueAtTime(
      1.0,
      audioCtx.currentTime + attackTime
    );

    // Decay/Sustain phase
    noteGain.gain.exponentialRampToValueAtTime(
      sustainLevel,
      audioCtx.currentTime + attackTime + decayTime
    );

    osc.start();

    activeOscillators[key] = { osc: osc, gain: noteGain };

    // Creative: Change background color based on frequency
    document.body.style.backgroundColor = getFrequencyColor(frequency);
  }

  function stopNote(key) {
    const activeNote = activeOscillators[key];
    if (activeNote) {
      const { osc, gain } = activeNote;
      const releaseTime = 0.2;

      // Release phase
      // Cancel any scheduled future changes
      gain.gain.cancelScheduledValues(audioCtx.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, audioCtx.currentTime); // Set current value as start point
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        audioCtx.currentTime + releaseTime
      ); // Ramp to near zero

      osc.stop(audioCtx.currentTime + releaseTime);

      // Cleanup
      setTimeout(() => {}, releaseTime * 1000);

      delete activeOscillators[key];
    }
  }

  function triggerVisual(key, isActive) {
    const keyEl = document.querySelector(`.key[data-key="${key}"]`);
    if (keyEl) {
      if (isActive) {
        keyEl.classList.add("key-active");
      } else {
        keyEl.classList.remove("key-active");
      }
    }
  }

  function getFrequencyColor(freq) {
    // Map frequency to hue
    const minFreq = 260;
    const maxFreq = 1000;
    const hue = ((freq - minFreq) / (maxFreq - minFreq)) * 360;
    return `hsl(${hue}, 20%, 15%)`;
  }
});
