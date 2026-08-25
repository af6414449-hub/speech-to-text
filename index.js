document.addEventListener('DOMContentLoaded', () => {
  const transcript = document.getElementById('transcript');
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const statusText = document.getElementById('statusText');
  const statusDot = document.getElementById('statusDot');

  let recognition = null;
  let isListening = false;
  let finalTranscript = '';
  let restartTimeout = null;
  let isManualStop = false;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    statusText.textContent = '❌ Браузер не поддерживает распознавание речи';
    statusText.className = 'error';
    startBtn.disabled = true;
    return;
  }

  function setStatus(text, type = '') {
    statusText.textContent = text;
    statusText.className = type;
    // Логируем в консоль для отладки
    console.log('Статус:', text);
  }

  function setDotState(state) {
    statusDot.className = 'status-dot';
    if (state === 'recording') {
      statusDot.classList.add('recording');
    } else if (state === 'listening') {
      statusDot.classList.add('listening');
    }
  }

  function initRecognition() {
    if (recognition) {
      try { recognition.abort(); } catch (e) {}
    }

    recognition = new SpeechRecognition();
    recognition.lang = 'ru-RU';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    // Для телефона добавляем дополнительные параметры
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onstart = () => {
      console.log('✅ Распознавание запущено');
      isListening = true;
      isManualStop = false;
      startBtn.disabled = true;
      stopBtn.disabled = false;
      setStatus('Слушаю...', 'active');
      setDotState('listening');
    };

    recognition.onresult = (event) => {
      console.log('🎤 Получен результат:', event);
      console.log('Количество результатов:', event.results.length);
      
      let interimText = '';
      let finalText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const chunk = result[0].transcript;
        console.log('Фрагмент текста:', chunk, 'isFinal:', result.isFinal);

        if (result.isFinal) {
          finalText += chunk + ' ';
        } else {
          interimText += chunk;
        }
      }

      console.log('Финальный текст:', finalText);
      console.log('Промежуточный текст:', interimText);

      if (finalText) {
        finalTranscript += finalText;
      }

      let displayText = finalTranscript;
      if (interimText) {
        displayText += (displayText ? ' ' : '') + interimText;
      }

      transcript.value = displayText;
      transcript.scrollTop = transcript.scrollHeight;

      if (interimText) {
        setDotState('listening');
      }
    };

    recognition.onerror = (event) => {
      console.error('❌ Ошибка:', event.error);
      
      if (event.error === 'not-allowed') {
        setStatus('❌ Доступ к микрофону запрещён', 'error');
        setDotState('');
        stopListening();
      } else if (event.error === 'no-speech') {
        setStatus('Тишина...', '');
        setDotState('recording');
      } else if (event.error === 'audio-capture') {
        setStatus('❌ Микрофон недоступен', 'error');
        setDotState('');
        stopListening();
      } else if (event.error === 'network') {
        setStatus('🌐 Проблема с сетью', '');
        if (isListening && !isManualStop) {
          setTimeout(() => {
            try { recognition.start(); } catch (e) {}
          }, 1000);
        }
      } else {
        setStatus(`⚠ ${event.error}`, '');
        if (isListening && !isManualStop && event.error !== 'not-allowed') {
          setTimeout(() => {
            try { 
              if (!isManualStop) recognition.start(); 
            } catch (e) {}
          }, 500);
        }
      }
    };

    recognition.onend = () => {
      console.log('⏹ Распознавание завершено');
      
      if (isListening && !isManualStop) {
        setStatus('Перезапуск...', '');
        setDotState('recording');
        
        if (restartTimeout) clearTimeout(restartTimeout);
        
        restartTimeout = setTimeout(() => {
          if (isListening && !isManualStop) {
            try {
              recognition.start();
            } catch (e) {
              if (isListening && !isManualStop) {
                restartTimeout = setTimeout(() => {
                  try { recognition.start(); } catch (err) {}
                }, 500);
              }
            }
          }
        }, 300);
      } else {
        isListening = false;
        startBtn.disabled = false;
        stopBtn.disabled = true;
        setStatus('Остановлено', '');
        setDotState('');
      }
    };

    recognition.onsoundstart = () => {
      console.log('🔊 Звук обнаружен');
      setStatus('Слушаю...', 'active');
      setDotState('listening');
    };

    recognition.onsoundend = () => {
      console.log('🔇 Звук закончился');
      if (isListening && !isManualStop) {
        setStatus('Пауза', '');
        setDotState('recording');
      }
    };

    recognition.onspeechstart = () => {
      console.log('🗣 Речь обнаружена');
      setDotState('listening');
    };
  }

  function startListening() {
    console.log('▶ Запуск распознавания...');
    if (isListening) return;

    if (transcript.value && !finalTranscript) {
      finalTranscript = transcript.value;
    }

    if (!recognition) {
      initRecognition();
    }

    isManualStop = false;
    isListening = true;
    setStatus('Запуск...', '');
    setDotState('recording');

    try {
      recognition.start();
    } catch (e) {
      console.error('Ошибка старта:', e);
      if (e.message && e.message.includes('already started')) {
        isListening = true;
        startBtn.disabled = true;
        stopBtn.disabled = false;
        setStatus('Слушаю...', 'active');
        setDotState('listening');
      } else {
        setStatus('❌ Ошибка запуска', 'error');
        isListening = false;
        startBtn.disabled = false;
        stopBtn.disabled = true;
        setDotState('');
      }
    }
  }

  function stopListening(manual = true) {
    console.log('⏹ Остановка...');
    isManualStop = manual;
    isListening = false;
    
    if (restartTimeout) {
      clearTimeout(restartTimeout);
      restartTimeout = null;
    }

    if (recognition) {
      try {
        recognition.stop();
      } catch (e) {}
    }

    startBtn.disabled = false;
    stopBtn.disabled = true;
    setStatus('Остановлено', '');
    setDotState('');
  }

  startBtn.addEventListener('click', startListening);
  stopBtn.addEventListener('click', () => {
    stopListening(true);
  });

  // Горячие клавиши
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      if (isListening) {
        stopListening(true);
      } else {
        startListening();
      }
    }
    if (e.key === 'Escape' && isListening) {
      e.preventDefault();
      stopListening(true);
    }
  });

  // Сохраняем текст
  transcript.addEventListener('input', () => {
    if (transcript.value && !transcript.value.startsWith(finalTranscript) && !finalTranscript.startsWith(transcript.value)) {
      finalTranscript = transcript.value;
    }
    try {
      chrome.storage.local.set({ transcript: transcript.value });
    } catch (e) {
      console.log('Storage не доступен (это нормально для PWA)');
    }
  });

  window.addEventListener('beforeunload', () => {
    if (isListening) {
      stopListening(true);
    }
    try {
      chrome.storage.local.set({ transcript: transcript.value });
    } catch (e) {}
  });

  // Восстанавливаем текст
  try {
    chrome.storage.local.get(['transcript'], (result) => {
      if (result.transcript) {
        transcript.value = result.transcript;
        finalTranscript = result.transcript;
      }
    });
  } catch (e) {
    console.log('Storage не доступен');
  }

  initRecognition();
  console.log('✅ Приложение загружено!');
});