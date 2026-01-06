;(function () {
  const QUIZ_STEPS = [
    { id: 1, question: '送分题哦！beily的身份证后六位加起来是多少？', answer: '24' },
    { id: 2, question: 'beily和martin在一起多少天了？', answer: '514' }
  ]

  const PASS_TEXT = [
    '/** 首先恭喜小佩奇闯过第一关！*/',
    '// 去年真的忙到飞起，连好好做一版新页面的时间都不太够。',
    '// 不过更重要的是——你还是来到了这一页。',
    '// 所以，按照约定，该发放一个小小的通关奖励了。',
    '// ----------------------------------------',
    '// 准备好了吗？',
    '// 倒计时启动：',
    '3…',
    '2…',
    '1…',
    '—— —— —— —— ——',
    '［12:44:10］ 初始化… 294.13 ms',
    '［12:44:10］ 解压中… 269.63 ms',
    '［12:44:10］ 组装中… 262.78 ms',
    '［12:44:11］ 打包中… 257.33 ms',
    '［12:44:11］ 编译中：',
    '＃＃＃＃＃＃＃＃＃＃ 100%',
    '［12:44:12］ 打开中…'
  ].join('\n')


  let gateEl
  let quizIndex = 0
  let typingTimer = null
  let typingIndex = 0
  let typingTarget = null
  let envelopeUnlocked = false
  let checkingAnswer = false

  function ensureGateRoot() {
    let el = document.getElementById('gate')
    if (!el) {
      el = document.createElement('div')
      el.id = 'gate'
      document.body.appendChild(el)
    }
    gateEl = el
    return el
  }

  function setStage(stage) {
    if (!gateEl) return
    gateEl.style.display = 'flex'
    gateEl.className = 'gate-visible gate-stage-' + stage
  }

  function focusInput(input) {
    try {
      if (input && typeof input.focus === 'function') {
        input.focus()
      }
    } catch (e) {}
  }

  function showQuiz(step) {
    if (!gateEl) return
    setStage('quiz')

    const total = QUIZ_STEPS.length
    const currentNo = quizIndex + 1

    gateEl.innerHTML =
      '<div class="gate-quiz-layer">' +
      '  <div class="gate-quiz-card" role="dialog" aria-modal="true" aria-labelledby="gate-quiz-title">' +
      '    <div class="gate-quiz-header">' +
      
      '      <h2 id="gate-quiz-title" class="gate-quiz-title">问题 ' +
      currentNo +
      ' / ' +
      total +
      '</h2>' +
      '    </div>' +
      '    <p class="gate-quiz-question">' +
      step.question +
      '</p>' +
      '    <div class="gate-quiz-input-row">' +
      '      <input id="gate-quiz-input" class="gate-quiz-input" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="请输入答案" />' +
      '    </div>' +
      '    <div class="gate-quiz-error" id="gate-quiz-error" aria-live="polite"></div>' +
      '    <div class="gate-quiz-actions">' +
      '      <button type="button" class="gate-btn gate-btn-ghost" id="gate-btn-cancel">再想想</button>' +
      '      <button type="button" class="gate-btn gate-btn-primary" id="gate-btn-ok">确定</button>' +
      '    </div>' +
      '  </div>' +
      '</div>'

    const card = gateEl.querySelector('.gate-quiz-card')
    const input = gateEl.querySelector('#gate-quiz-input')
    const errorEl = gateEl.querySelector('#gate-quiz-error')
    const btnCancel = gateEl.querySelector('#gate-btn-cancel')
    const btnOk = gateEl.querySelector('#gate-btn-ok')

    function clearError() {
      if (!card) return
      card.classList.remove('gate-error')
      if (errorEl) errorEl.textContent = ''
    }

    function shake() {
      if (!card) return
      card.classList.remove('gate-shake')
      void card.offsetWidth
      card.classList.add('gate-shake')
      setTimeout(function () {
        card.classList.remove('gate-shake')
      }, 280)
    }

    function showError(msg) {
      if (!card) return
      card.classList.add('gate-error')
      if (errorEl) errorEl.textContent = msg || '再想一想~'
      shake()
    }

    function handleConfirm() {
      if (checkingAnswer) return
      if (!input) return
      const raw = (input.value || '').trim()
      if (!raw) {
        showError('请输入答案')
        return
      }
      checkingAnswer = true
      clearError()

      const expected = String(step.answer).trim()
      if (raw === expected) {
        quizIndex += 1
        checkingAnswer = false
        if (quizIndex >= QUIZ_STEPS.length) {
          showPass()
        } else {
          showQuiz(QUIZ_STEPS[quizIndex])
        }
      } else {
        checkingAnswer = false
        showError('好像不太对，再试一次')
        try {
          input.select()
        } catch (e) {}
      }
    }

    if (btnOk) {
      btnOk.addEventListener('click', handleConfirm)
    }
    if (input) {
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault()
          handleConfirm()
        } else if (card && card.classList.contains('gate-error')) {
          clearError()
        }
      })
    }
    if (btnCancel) {
      btnCancel.addEventListener('click', function () {
        if (checkingAnswer) return
        showError('不如再想一想？')
        focusInput(input)
      })
    }

    focusInput(input)
  }

  function startTyping() {
    if (!typingTarget) {
      showEnvelope()
      return
    }

    if (typingTimer) {
      clearTimeout(typingTimer)
      typingTimer = null
    }

    const text = PASS_TEXT
    typingIndex = 0
    typingTarget.textContent = ''

    const baseDelay = 34

    function tick() {
      typingIndex += 1
      typingTarget.textContent = text.slice(0, typingIndex)
      if (typingIndex < text.length) {
        const ch = text.charAt(typingIndex)
        let delay = baseDelay
        if (ch === '\n') {
          delay = 90
        }
        typingTimer = setTimeout(tick, delay)
      } else {
        typingTimer = null
        setTimeout(function () {
          showEnvelope()
        }, 800)
      }
    }

    tick()
  }

  function showPass() {
    if (!gateEl) return
    setStage('pass')

    gateEl.innerHTML =
      '<div class="gate-pass-layer">' +
      '  <div class="gate-pass-inner">' +
      '    <div class="gate-pass-label">LEVEL CLEAR</div>' +
      '    <div class="gate-pass-title">恭喜通关！</div>' +
      '    <div class="gate-pass-text" id="gate-pass-text"></div>' +
      '  </div>' +
      '</div>'

    typingTarget = gateEl.querySelector('#gate-pass-text')
    startTyping()
  }

  function unlockFireworks() {
    if (envelopeUnlocked) return
    envelopeUnlocked = true

    // 解锁烟花发射
    if (typeof window.enableFireworks === 'function') {
      window.enableFireworks()
    } else {
      window.__gate_fireworks_pending = true
    }

    // 背景音乐：优先网易云外链，失败则回退本地 mp3
    try {
      const audio = document.getElementById('bg-audio')
      if (!audio) return

      const remoteSrc = 'https://music.163.com/song/media/outer/url?id=259066.mp3'
      const fallbackSrc = audio.currentSrc || audio.src || audio.getAttribute('src') || ''

      audio.muted = false
      audio.loop = true

      const playWithCatch = () => {
        try {
          const p = audio.play()
          if (p && typeof p.catch === 'function') {
            p.catch(function () {})
          }
        } catch (e) {}
      }

      const tryRemoteThenFallback = () => {
        let triedFallback = false
        try {
          if (remoteSrc) {
            audio.src = remoteSrc
            const p = audio.play()
            if (p && typeof p.catch === 'function') {
              p.catch(function () {
                if (triedFallback) return
                triedFallback = true
                if (fallbackSrc) {
                  audio.src = fallbackSrc
                  const p2 = audio.play()
                  if (p2 && typeof p2.catch === 'function') {
                    p2.catch(function () {})
                  }
                }
              })
            }
          } else if (fallbackSrc) {
            audio.src = fallbackSrc
            playWithCatch()
          }
        } catch (e) {
          if (!triedFallback && fallbackSrc) {
            triedFallback = true
            audio.src = fallbackSrc
            playWithCatch()
          }
        }
      }

      tryRemoteThenFallback()
    } catch (e) {
      // 静默处理音频错误，避免影响解锁流程
    }
  }

  function showEnvelope() {
    if (!gateEl) return
    setStage('envelope')

    gateEl.innerHTML =
      '<div class="gate-envelope-layer">' +

      '  <div class="gate-envelope" id="gate-envelope" aria-label="开启生日惊喜信封">' +
      '    <div class="gate-envelope-body">' +
      '      <div class="gate-envelope-flap">' +
      '        <div class="gate-envelope-seal">开</div>' +
      '      </div>' +
      '      <div class="gate-envelope-pocket"></div>' +
      '      <div class="gate-envelope-letter">' +
      '        <h2>生日惊喜已就绪</h2>' +
      '        <p>刚刚那两道题，只是为这一场烟花秀增加一点小小的期待。</p>' +
      '        <p>接下来，把视线交给夜空，让烟花替你记住这一刻。</p>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '</div>'

    const envelope = document.getElementById('gate-envelope')
    if (!envelope) return

    let opened = false

    const handleOpen = function () {
      if (opened) return
      opened = true
      envelope.classList.add('opened')
      unlockFireworks()

      if (gateEl) {
        gateEl.classList.add('gate-fade-out')
        setTimeout(function () {
          gateEl.classList.remove('gate-visible')
          gateEl.classList.add('gate-hidden')
          gateEl.style.display = 'none'
          gateEl.innerHTML = ''
        }, 1000)
      }
    }

    envelope.addEventListener('click', handleOpen)

    setTimeout(function () {
      envelope.classList.add('gate-envelope-emphasize')
    }, 600)
  }

  function bootstrap() {
    const root = ensureGateRoot()
    if (!root) return
    quizIndex = 0
    checkingAnswer = false
    envelopeUnlocked = false
    if (typingTimer) {
      clearTimeout(typingTimer)
      typingTimer = null
    }
    showQuiz(QUIZ_STEPS[quizIndex])
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap)
  } else {
    bootstrap()
  }
})()
