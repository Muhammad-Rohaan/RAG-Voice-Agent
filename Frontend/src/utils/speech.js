export const isSpeechRecognitionSupported = () => {
  return typeof window !== 'undefined' && 
    (!!window.SpeechRecognition || !!window.webkitSpeechRecognition);
};

export const getSpeechRecognitionConstructor = () => {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition;
};

export const isSpeechSynthesisSupported = () => {
  return typeof window !== 'undefined' && !!window.speechSynthesis;
};

// Returns a Promise that resolves to the best available English voice
export const getEnglishVoice = () => {
  return new Promise((resolve) => {
    if (!isSpeechSynthesisSupported()) {
      resolve(null);
      return;
    }

    const synth = window.speechSynthesis;
    let voices = synth.getVoices();

    if (voices.length > 0) {
      resolve(selectBestVoice(voices));
      return;
    }

    // Chrome/Safari load voices asynchronously, need to listen to onvoiceschanged
    synth.onvoiceschanged = () => {
      voices = synth.getVoices();
      resolve(selectBestVoice(voices));
    };
  });
};

function selectBestVoice(voices) {
  // Prefer natural sounding English voices
  const preferred = [
    'Google US English',
    'Microsoft Aria Online',
    'Microsoft Guy Online',
    'Google UK English Female',
    'Google UK English Male',
    'en-US',
    'en-GB'
  ];

  // Try to find exact matches from preferred list
  for (const name of preferred) {
    const found = voices.find(v => v.name.toLowerCase().includes(name.toLowerCase()) || v.lang.toLowerCase() === name.toLowerCase());
    if (found) return found;
  }

  // Fallback to any English voice
  const englishVoice = voices.find(v => v.lang.startsWith('en'));
  if (englishVoice) return englishVoice;

  // Fallback to default voice
  return voices[0] || null;
}
