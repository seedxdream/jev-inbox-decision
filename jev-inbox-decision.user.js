// ==UserScript==
// @name         Jev Inbox Decision · AI Agent Decision Layer for Gmail
// @namespace    https://typesafe.ai/
// @version      1.1.1
// @description  Jev System One AI Agent Decision Layer Demo on Gmail. LLM generates, Jev decides.
// @author       TypeSafe AI Demo
// @match        https://mail.google.com/*
// @noframes
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      api.typesafe.ai
// @connect      *
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  /* ==========================================================================
     1. STORAGE & CONFIG
     ========================================================================== */
  const Storage = {
    KEY_NAME: 'jev_api_key',
    getApiKey() {
      try {
        if (typeof GM_getValue === 'function') {
          const val = GM_getValue(this.KEY_NAME, '');
          if (val) return val;
        }
      } catch (_) {}
      try {
        return localStorage.getItem(this.KEY_NAME) || '';
      } catch (_) {
        return '';
      }
    },
    setApiKey(key) {
      const trimmed = (key || '').trim();
      try {
        if (typeof GM_setValue === 'function') {
          GM_setValue(this.KEY_NAME, trimmed);
        }
      } catch (_) {}
      try {
        localStorage.setItem(this.KEY_NAME, trimmed);
      } catch (_) {}
      return trimmed;
    },
    clearApiKey() {
      try {
        if (typeof GM_setValue === 'function') {
          GM_setValue(this.KEY_NAME, '');
        }
      } catch (_) {}
      try {
        localStorage.removeItem(this.KEY_NAME);
      } catch (_) {}
    },
    hasApiKey() {
      return !!this.getApiKey();
    }
  };

  const isRealGmail = typeof location !== 'undefined' && location.href.includes('mail.google.com');

  const CONFIG = {
    JEV_API_URL: 'https://api.typesafe.ai/v1/systemone',
    USE_MOCK: isRealGmail ? false : true,
    JEV_MODEL: 'jev-latest',
    ANIMATION_DELAY_MS: 1200, // Duration per email in demo (recording sweet spot)
    CONTAINER_ID: 'jev-decision-layer-container'
  };

  // Gmail enforces Trusted Types (TrustedHTML) CSP policy.
  let jevTrustedPolicy = null;
  function safeSetHTML(element, htmlString) {
    if (!element) return;
    if (window.trustedTypes && window.trustedTypes.createPolicy) {
      if (!jevTrustedPolicy) {
        try {
          jevTrustedPolicy = window.trustedTypes.createPolicy('jev-trusted-policy', {
            createHTML: (string) => string
          });
        } catch (e) {
          try {
            jevTrustedPolicy = window.trustedTypes.defaultPolicy || { createHTML: (s) => s };
          } catch (_) {
            jevTrustedPolicy = { createHTML: (s) => s };
          }
        }
      }
      try {
        element.innerHTML = jevTrustedPolicy.createHTML ? jevTrustedPolicy.createHTML(htmlString) : htmlString;
        return;
      } catch (e) {}
    }
    element.innerHTML = htmlString;
  }

  
  const ACTION_META = {
    VIEW_NOW: { text: '立即查看', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)', border: 'rgba(56, 189, 248, 0.35)' },
    READ_LATER: { text: '稍后阅读', color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.15)', border: 'rgba(167, 139, 250, 0.35)' },
    REPLY: { text: '需要回复', color: '#34d399', bg: 'rgba(52, 211, 153, 0.15)', border: 'rgba(52, 211, 153, 0.35)' },
    ARCHIVE: { text: '归档', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)', border: 'rgba(148, 163, 184, 0.35)' },
    IGNORE: { text: '忽略', color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.15)', border: 'rgba(244, 63, 94, 0.35)' }
  };

  /* ==========================================================================
     3. GmailDomAdapter
     Encapsulates all Gmail selectors. Never scatter Gmail DOM queries.
     ========================================================================== */
  class GmailDomAdapter {
    static getVisibleEmails() {
      const emailRows = [];
      const selectors = [
        'tr.zA',
        'div[role="main"] table.F tr[role="row"]',
        'div[role="tabpanel"] tr[role="row"]',
        'tr[role="row"].zA'
      ];

      let rows = [];
      for (const sel of selectors) {
        const found = document.querySelectorAll(sel);
        if (found && found.length > 0) {
          rows = Array.from(found);
          break;
        }
      }

      rows.forEach((row, idx) => {
        if (row.offsetHeight === 0 || row.offsetWidth === 0) return;

        const id = row.getAttribute('id') || row.getAttribute('data-legacy-thread-id') || `gmail-row-${idx}`;

        const senderEl = row.querySelector('.yP, .zF, span[email], .bA4 span, td.yX span');
        const sender = senderEl ? (senderEl.getAttribute('email') || senderEl.textContent.trim()) : '未知发件人';

        const subjectEl = row.querySelector('span.bog, .bqe, td.xY span');
        const subject = subjectEl ? subjectEl.textContent.trim() : '(无主题)';

        const snippetEl = row.querySelector('span.y2, .y6');
        let snippet = snippetEl ? snippetEl.textContent.trim() : '';
        if (snippet.startsWith('-') || snippet.startsWith('—')) {
          snippet = snippet.replace(/^[-—\s]+/, '').trim();
        }

        const unread = row.classList.contains('zE');
        const starredEl = row.querySelector('.T-KT-Jp, [aria-label*="starred"], .T-KT[aria-checked="true"]');
        const starred = !!starredEl;

        emailRows.push({
          id,
          sender,
          subject,
          snippet,
          unread,
          starred,
          element: row
        });
      });

      return emailRows;
    }

    static findEmailRow(id) {
      if (!id) return null;

      // Direct match
      let row = document.getElementById(id);
      if (row) return row;
      row = document.querySelector(`tr[data-legacy-thread-id="${id}"]`);
      if (row) return row;

      // If running Demo Inbox mode on real Gmail, map demo-X to the X-th visible row for live visual sync!
      if (id.startsWith('demo-')) {
        const idx = parseInt(id.replace('demo-', ''), 10) - 1;
        const allRows = document.querySelectorAll('tr.zA, div[role="main"] table.F tr[role="row"]');
        if (allRows && allRows[idx]) return allRows[idx];
      }

      if (id.startsWith('gmail-row-')) {
        const index = parseInt(id.replace('gmail-row-', ''), 10);
        const allRows = document.querySelectorAll('tr.zA');
        if (allRows && allRows[index]) return allRows[index];
      }

      return null;
    }

    static highlightEmail(id) {
      const row = this.findEmailRow(id);
      if (!row) return;

      row.classList.add('jev-email-highlighted');
      row.style.transition = 'all 0.3s ease';
      row.style.outline = '2px solid #6366f1';
      row.style.outlineOffset = '-2px';
      row.style.backgroundColor = 'rgba(99, 102, 241, 0.12)';
      row.style.boxShadow = '0 0 18px rgba(99, 102, 241, 0.28)';

      try {
        row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (e) {}
    }

    static clearHighlight(id) {
      const row = this.findEmailRow(id);
      if (!row) return;

      row.classList.remove('jev-email-highlighted');
      row.style.outline = '';
      row.style.outlineOffset = '';
      row.style.backgroundColor = '';
      row.style.boxShadow = '';
    }

    static clearAllHighlights() {
      const highlighted = document.querySelectorAll('.jev-email-highlighted');
      highlighted.forEach(row => {
        row.classList.remove('jev-email-highlighted');
        row.style.outline = '';
        row.style.outlineOffset = '';
        row.style.backgroundColor = '';
        row.style.boxShadow = '';
      });
    }

    static markAsRead(id) {
      const row = this.findEmailRow(id);
      if (!row) return;

      if (row.classList.contains('zE')) {
        row.classList.remove('zE');
        row.classList.add('yO');

        const dot = row.querySelector('.unread-dot, .unread-indicator');
        if (dot) dot.style.display = 'none';

        const sidebarCounters = document.querySelectorAll('.bsU, #sidebar-inbox-count, #sidebar-unread-count');
        sidebarCounters.forEach(counter => {
          const val = parseInt(counter.textContent.replace(/[^0-9]/g, ''), 10);
          if (!isNaN(val) && val > 0) {
            counter.textContent = String(val - 1);
          }
        });
      }
    }

    static initRowClickListeners(onRowClick) {
      document.addEventListener('click', (e) => {
        if (e.target.closest('#' + CONFIG.CONTAINER_ID) || e.target.closest('#jev-trigger-pill')) {
          return;
        }

        const row = e.target.closest('tr.zA, div[role="main"] table.F tr[role="row"]');
        if (!row) return;

        // Allow checkbox selection without triggering Jev detail view
        if (e.target.tagName === 'INPUT' && e.target.type === 'checkbox') return;

        let id = row.getAttribute('id') || row.getAttribute('data-legacy-thread-id');
        if (!id) {
          const allRows = Array.from(document.querySelectorAll('tr.zA, div[role="main"] table.F tr[role="row"]'));
          const idx = allRows.indexOf(row);
          if (idx !== -1) {
            id = `gmail-row-${idx}`;
            row.setAttribute('id', id);
          }
        }

        if (id && onRowClick) {
          onRowClick(id, row);
        }
      }, false);
    }

    static injectRowBadge(emailId, decision) {
      const row = this.findEmailRow(emailId);
      if (!row || !decision || !decision.action) return;

      const oldBadge = row.querySelector('.jev-row-badge');
      if (oldBadge) oldBadge.remove();

      const badge = document.createElement('span');
      badge.className = 'jev-row-badge';
      badge.setAttribute('data-jev-id', emailId);

      const val = decision.action.value;
      const needLLM = (decision.needLLM && decision.needLLM.probability >= 0.45) || val === 'REPLY';

      let text = '稍后阅读';
      let style = 'background:rgba(99,102,241,0.15); color:#818cf8; border:1px solid rgba(99,102,241,0.35);';

      if (val === 'REPLY' || needLLM) {
        text = '💬 需回复 · LLM';
        style = 'background:rgba(236,72,153,0.18); color:#f472b6; border:1px solid rgba(236,72,153,0.45); font-weight:700;';
      } else if (val === 'VIEW_NOW') {
        text = '⚡ 立即查看';
        style = 'background:rgba(56,189,248,0.18); color:#38bdf8; border:1px solid rgba(56,189,248,0.4); font-weight:700;';
      } else if (val === 'ARCHIVE') {
        text = '📦 建议归档';
        style = 'background:rgba(148,163,184,0.12); color:#94a3b8; border:1px solid rgba(148,163,184,0.25);';
      } else if (val === 'IGNORE') {
        text = '🚫 忽略';
        style = 'background:rgba(244,63,94,0.12); color:#fb7185; border:1px solid rgba(244,63,94,0.25);';
      } else {
        text = '📖 稍后阅读';
        style = 'background:rgba(167,139,250,0.15); color:#c084fc; border:1px solid rgba(167,139,250,0.35);';
      }

      badge.setAttribute('style', style);
      safeSetHTML(badge, text);

      // Insert adjacent to subject
      const subjectSpan = row.querySelector('span.bog, .bqe, td.xY');
      if (subjectSpan) {
        subjectSpan.parentNode.insertBefore(badge, subjectSpan.nextSibling);
      } else {
        row.appendChild(badge);
      }

      badge.onclick = (e) => {
        e.stopPropagation();
        if (window.jevFloatingPanel) {
          window.jevFloatingPanel.showEmailDecision(emailId, true);
        }
      };
    }

    static _identity(email) {
      const normalize = (value) => String(value || '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
      return `${normalize(email.sender)}\u0000${normalize(email.subject)}`;
    }

    static restoreDecisionBadges(results) {
      if (!Array.isArray(results) || results.length === 0) return;

      const decisionsByEmail = new Map();
      results.forEach(result => {
        if (result && result.email && result.decision) {
          decisionsByEmail.set(this._identity(result.email), result.decision);
        }
      });

      this.getVisibleEmails().forEach(email => {
        if (email.element.querySelector('.jev-row-badge')) return;
        const decision = decisionsByEmail.get(this._identity(email));
        if (decision) this.injectRowBadge(email.id, decision);
      });
    }

    static getOpenedEmailDetails() {
      // 1. Check real Gmail message thread DOM
      const subjectEl = document.querySelector('h2.hP, div[role="main"] h2');
      if (subjectEl && subjectEl.offsetHeight > 0) {
        const senderEl = document.querySelector('span.gD, .gE.iv span[email], div[role="main"] span[email]');
        const bodyEl = document.querySelector('div.a3s.aiL, div[role="main"] .ii.gt');
        const subject = subjectEl.textContent.trim();
        const sender = senderEl ? (senderEl.getAttribute('email') || senderEl.textContent.trim()) : '未知发件人';
        const snippet = bodyEl ? bodyEl.textContent.trim().substring(0, 300) : '';

        // Extract thread ID from URL hash (#inbox/FMfcgz...) or generate from subject
        const hashMatch = location.hash.match(/#.+?\/([a-zA-Z0-9_-]+)/);
        const id = hashMatch ? hashMatch[1] : `thread-${encodeURIComponent(subject.substring(0, 16))}`;

        return {
          id,
          sender,
          subject,
          snippet,
          unread: false,
          starred: false,
          isOpenedThread: true
        };
      }

      // 2. Check standalone preview demo detail view
      const demoDetailView = document.getElementById('view-mail-detail');
      if (demoDetailView && demoDetailView.style.display !== 'none' && typeof currentViewingEmailId !== 'undefined' && currentViewingEmailId) {
        if (typeof FULL_EMAILS_DB !== 'undefined') {
          const matched = FULL_EMAILS_DB.find(e => e.id === currentViewingEmailId);
          if (matched) return matched;
        }
      }

      return null;
    }

    static fillDraftIntoGmailReply(draftText) {
      if (!draftText) return false;

      // Always copy to clipboard as safe backup
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(draftText).catch(() => {});
      }

      // 1. If in preview demo, fill into demo detail reply box if exists
      const demoBox = document.getElementById('demo-reply-textarea');
      if (demoBox) {
        demoBox.value = draftText;
        demoBox.scrollIntoView({ behavior: 'smooth' });
        return true;
      }

      // 2. In real Gmail: find and trigger "Reply" button
      const replyBtn = document.querySelector('span[role="link"][data-tooltip*="Reply"], .ams.bkH, div[aria-label*="Reply"], div[data-tooltip*="回复"]');
      if (replyBtn) {
        replyBtn.click();
      }

      setTimeout(() => {
        // Find compose body in Gmail
        const composeBody = document.querySelector('div[aria-label*="Message Body"], div[aria-label*="邮件正文"], div[role="textbox"][g_editable="true"], div.Am.Al.editable');
        if (composeBody) {
          composeBody.focus();
          try {
            document.execCommand('insertText', false, draftText);
          } catch (_) {
            composeBody.textContent = draftText;
          }
          composeBody.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 350);

      return true;
    }
  }

  /* ==========================================================================
     4. MockJevClient
     Deterministic output for stable, reproducible video recording.
     ========================================================================== */
  class MockJevClient {
    static async analyzeEmail(email) {
      // 1. Check if matched in external demo benchmarks (e.g. from demo-data.js for recording)
      const demoList = (typeof window !== 'undefined' && window.JEV_DEMO_EMAILS) || [];
      const matched = demoList.find(d => d.id === email.id || (d.subject && email.subject && d.subject === email.subject));
      if (matched && matched.mockResult) {
        return JSON.parse(JSON.stringify(matched.mockResult));
      }

      // 2. Deterministic heuristic for arbitrary real Gmail emails in Mock mode
      const text = `${email.sender || ''} ${email.subject || ''} ${email.snippet || ''}`.toLowerCase();

      let action = 'READ_LATER';
      let importanceScore = 2;
      let todayProb = 0.65;
      let needLLMProb = 0.08;
      let promotionProb = 0.20;

      if (text.includes('折') || text.includes('优惠') || text.includes('sale') || text.includes('offer') || text.includes('促销') || text.includes('退订') || text.includes('unsubscribe')) {
        action = 'ARCHIVE';
        importanceScore = 0;
        todayProb = 0.05;
        needLLMProb = 0.01;
        promotionProb = 0.95;
      } else if (text.includes('发票') || text.includes('账单') || text.includes('receipt') || text.includes('invoice') || text.includes('消费') || text.includes('扣款')) {
        action = 'ARCHIVE';
        importanceScore = 1;
        todayProb = 0.08;
        needLLMProb = 0.00;
        promotionProb = 0.04;
      } else if (text.includes('邀请') || text.includes('约') || text.includes('聚') || text.includes('请教') || text.includes('回复') || text.includes('? ') || text.includes('？') || text.includes('interview')) {
        action = 'REPLY';
        importanceScore = 3;
        todayProb = 0.88;
        needLLMProb = 0.85;
        promotionProb = 0.02;
      } else if (text.includes('紧急') || text.includes('urgent') || text.includes('确认') || text.includes('评审') || text.includes('deadline') || text.includes('issue') || text.includes('bug')) {
        action = 'VIEW_NOW';
        importanceScore = 4;
        todayProb = 0.95;
        needLLMProb = 0.25;
        promotionProb = 0.00;
      } else if (text.includes('seo') || text.includes('business proposal') || text.includes('商务合作') || text.includes('群发')) {
        action = 'IGNORE';
        importanceScore = 0;
        todayProb = 0.02;
        needLLMProb = 0.00;
        promotionProb = 0.96;
      }

      const probs = { VIEW_NOW: 0.04, READ_LATER: 0.04, REPLY: 0.04, ARCHIVE: 0.04, IGNORE: 0.04 };
      probs[action] = 0.84;

      return {
        action: {
          value: action,
          label: ACTION_META[action].text,
          probabilities: probs,
          confidence: 0.91
        },
        importance: {
          score: importanceScore,
          label: ['基本无关', '低价值', '一般', '重要', '非常重要'][importanceScore],
          confidence: 0.88
        },
        processToday: {
          probability: todayProb
        },
        needLLM: {
          probability: needLLMProb
        },
        promotion: {
          probability: promotionProb
        }
      };
    }
  }

  /* ==========================================================================
     5. RealJevClient
     Live integration with TypeSafe System One API (POST https://api.typesafe.ai/v1/systemone)
     Uses GM_xmlhttpRequest to bypass CORS.
     ========================================================================== */
  class RealJevClient {
    static _pickNumber(...values) {
      for (const value of values) {
        const num = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
        if (typeof num === 'number' && Number.isFinite(num)) return num;
      }
      return null;
    }

    static _normalizeAction(actionAns) {
      const allowed = Object.keys(ACTION_META);
      const direct = [actionAns.choice, actionAns.value, actionAns.answer, actionAns.label]
        .find(value => typeof value === 'string' && value.trim());
      if (direct) {
        const normalized = direct.trim().toUpperCase().replace(/[\s-]+/g, '_');
        if (allowed.includes(normalized)) return normalized;
      }

      // A few compatible gateways return only the probability map.
      if (actionAns.probabilities && typeof actionAns.probabilities === 'object') {
        const ranked = Object.entries(actionAns.probabilities)
          .filter(([key, value]) => allowed.includes(key) && Number.isFinite(Number(value)))
          .sort((a, b) => Number(b[1]) - Number(a[1]));
        if (ranked.length) return ranked[0][0];
      }
      return null;
    }

    static parseResponse(resText) {
      const data = typeof resText === 'string' ? JSON.parse(resText) : resText;
      const answers = data && (data.answers || (data.result && data.result.answers));
      if (!answers || typeof answers !== 'object') {
        throw new Error('Jev 响应缺少 answers；请检查 API Key、模型名或接口版本');
      }

      const actionAns = answers.action || {};
      const importanceAns = answers.importance || {};
      const todayAns = answers.processToday || {};
      const needLLMAns = answers.needLLM || {};
      const promoAns = answers.promotion || {};
      const chosenAction = this._normalizeAction(actionAns);

      // Never silently turn an invalid/missing response into READ_LATER.
      if (!chosenAction) {
        throw new Error(`Jev action 响应无效（字段：${Object.keys(actionAns).join(', ') || '空'}）`);
      }

      const rawScore = this._pickNumber(importanceAns.score, importanceAns.value);
      const clampedScore = Math.max(0, Math.min(4, Math.round(rawScore === null ? 2 : rawScore)));
      const readNoul = (answer, fallback) => {
        const value = this._pickNumber(answer && answer.noul, answer && answer.probability, answer && answer.value, typeof answer === 'number' ? answer : null);
        return value === null ? fallback : Math.max(0, Math.min(1, value));
      };

      return {
        action: {
          value: chosenAction,
          label: ACTION_META[chosenAction].text,
          probabilities: actionAns.probabilities || { [chosenAction]: 1.0 },
          confidence: this._pickNumber(actionAns.confidence) ?? 0.85
        },
        importance: {
          score: clampedScore,
          label: ['基本无关', '低价值', '一般', '重要', '非常重要'][clampedScore],
          confidence: this._pickNumber(importanceAns.confidence) ?? 0.85
        },
        processToday: { probability: readNoul(todayAns, 0.5) },
        needLLM: { probability: readNoul(needLLMAns, 0.1) },
        promotion: { probability: readNoul(promoAns, 0.1) },
        meta: { source: 'jev-api', model: data.model || CONFIG.JEV_MODEL }
      };
    }

    static async analyzeEmail(email) {
      const payload = {
        state: {
          sender: email.sender || '',
          subject: email.subject || '',
          snippet: email.snippet || '',
          unread: email.unread,
          starred: email.starred
        },
        model: CONFIG.JEV_MODEL,
        questions: {
          action: {
            type: 'choice',
            instructions: '在个人私人邮箱场景下，只选择一个最合适的下一步动作。按优先级判断：需要本人回复 > 今天必须查看或处理 > 值得以后阅读 > 值得留档 > 无价值忽略。不要因为邮件未读就默认稍后阅读。',
            criteria: {
              REPLY: '明确期待本人答复、确认、接受或拒绝的对话；即使也很紧急，仍优先选 REPLY',
              VIEW_NOW: '不以回复为主要动作，但存在今天的截止时间、安全风险、账户异常、服务中断或待执行任务，需要现在查看处理',
              READ_LATER: '没有截止时间和后续动作，但内容与用户兴趣或工作相关，值得以后主动阅读',
              ARCHIVE: '无需行动但值得保留的交易凭证、发票、账单、完成通知、合规记录或账户记录',
              IGNORE: '无行动、无阅读价值、也无留档价值的垃圾邮件、骚扰、冷推广、重复营销或过期信息'
            }
          },
          importance: {
            type: 'score',
            instructions: '这封邮件对个人用户的重要程度与价值等级。',
            criteria: [
              '基本无关或垃圾营销',
              '低价值通知或收据',
              '一般参考资讯',
              '重要工作或朋友沟通',
              '非常重要或紧急事项'
            ]
          },
          processToday: {
            type: 'noul',
            instructions: '用户今天是否值得花时间处理或阅读这封邮件？',
            criteria: {
              true: '今天有截止时间、风险、重要沟通或明确行动价值',
              false: '可以安全推迟、仅供留档或没有价值'
            }
          },
          needLLM: {
            type: 'noul',
            instructions: '完成这封邮件的下一步动作（如起草回复、提炼复杂内容），是否需要生成式大模型 (LLM) 参与？',
            criteria: {
              true: '需要生成个性化文字、总结复杂长文或结合上下文推理',
              false: '只需阅读、点击、留档、忽略或执行简单确定动作'
            }
          },
          promotion: {
            type: 'noul',
            instructions: '这封邮件是否主要属于广告、商业促销或营销推广？',
            criteria: {
              true: '主要目的是推销、促销、拉新、冷启动商务开发或诱导购买',
              false: '主要是个人沟通、事务通知、用户主动订阅内容或交易记录'
            }
          }
        }
      };

      return new Promise((resolve, reject) => {
        const apiKey = Storage.getApiKey();
        if (!apiKey) {
          reject(new Error('未检测到 Jev API Key，请先在浮窗中输入并保存'));
          return;
        }

        const handleResponse = (resText) => {
          try {
            resolve(this.parseResponse(resText));
          } catch (err) {
            reject(err);
          }
        };

        if (typeof GM_xmlhttpRequest === 'function') {
          GM_xmlhttpRequest({
            method: 'POST',
            url: CONFIG.JEV_API_URL,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            data: JSON.stringify(payload),
            timeout: 10000,
            onload: (res) => {
              if (res.status >= 200 && res.status < 300) {
                handleResponse(res.responseText);
              } else {
                reject(new Error(`Jev API Error: ${res.status} ${res.statusText} - ${res.responseText}`));
              }
            },
            ontimeout: () => reject(new Error('Jev API request timeout')),
            onerror: (err) => reject(new Error('Jev API request failed: ' + (err.error || err.statusText || 'Network error')))
          });
        } else {
          reject(new Error('当前环境没有 GM_xmlhttpRequest；请将脚本安装到 Tampermonkey 后在 Gmail 中运行'));
        }
      });
    }
  }

  /* ==========================================================================
     6. DecisionEngine
     Coordinates batch processing, timing, events, and metrics.
     ========================================================================== */
  class DecisionEngine {
    constructor() {
      this.isAnalyzing = false;
      this.results = [];
      this.onProgress = null;
      this.onComplete = null;
      this.currentEmailIndex = 0;
    }

    async run(emails, engineType = 'mock', delayMs = 1200) {
      this.isAnalyzing = true;
      this.results = [];
      this.currentEmailIndex = 0;

      for (let i = 0; i < emails.length; i++) {
        if (!this.isAnalyzing) break;

        this.currentEmailIndex = i;
        const email = emails[i];

        // 1. Highlight in Gmail DOM
        GmailDomAdapter.highlightEmail(email.id);

        // 2. Notify start
        if (this.onProgress) {
          this.onProgress({
            phase: 'email_start',
            index: i,
            total: emails.length,
            email: email
          });
        }

        // 3. Call Jev Client
        let decision;
        try {
          if (engineType === 'real') {
            decision = await RealJevClient.analyzeEmail(email);
          } else {
            decision = await MockJevClient.analyzeEmail(email);
          }
        } catch (err) {
          console.warn('[Jev] API 调用/解析失败，已使用本地规则降级：', err);
          decision = await MockJevClient.analyzeEmail(email);
          decision.meta = {
            source: 'local-fallback',
            error: err && err.message ? err.message : String(err)
          };
        }

        const resultRecord = { email, decision };
        this.results.push(resultRecord);

        // Staggered progressive animation (ideal for video demonstration)
        // Step A: Choice revealed
        await this._sleep(Math.round(delayMs * 0.32));
        if (this.onProgress) {
          this.onProgress({
            phase: 'step_choice',
            index: i,
            total: emails.length,
            email,
            decision
          });
        }

        // Step B: Score & Nouls revealed
        await this._sleep(Math.round(delayMs * 0.34));
        GmailDomAdapter.injectRowBadge(email.id, decision);
        if (this.onProgress) {
          this.onProgress({
            phase: 'step_complete',
            index: i,
            total: emails.length,
            email,
            decision
          });
        }

        // Step C: Dwell time before next email
        await this._sleep(Math.round(delayMs * 0.34));

        // 4. Clear highlight
        GmailDomAdapter.clearHighlight(email.id);
      }

      this.isAnalyzing = false;
      GmailDomAdapter.clearAllHighlights();

      if (this.onComplete) {
        this.onComplete(this.results);
      }
    }

    stop() {
      this.isAnalyzing = false;
      GmailDomAdapter.clearAllHighlights();
    }

    _sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }
  }

  /* ==========================================================================
     7. DecisionRenderer
     Renders live email decision card with interactive animations.
     ========================================================================== */
  class DecisionRenderer {
    static generateSuggestedDraft(email) {
      const subject = email.subject || '';
      const sender = (email.sender || '').split('<')[0].trim();
      if (subject.includes('聚') || subject.includes('晚上') || subject.includes('有空')) {
        return '嗨 ' + (sender || '朋友') + '！这周五晚上我有空，三里屯那家云南菜听起来很赞！我们 7:30 见，提前预定辛苦啦！';
      }
      if (subject.includes('邀请') || subject.includes('interview') || subject.includes('面试')) {
        return '您好，感谢邀请！我对该事项非常期待。周三下午 2:00 或周四上午 10:00 我时间均方便，我们可以通过视频电话详细交流。祝好！';
      }
      if (subject.includes('合作') || subject.includes('proposal') || subject.includes('商务')) {
        return '您好，感谢您的来信与合作提议。关于 ' + subject + '，我们团队评估后很感兴趣，方便发一份详细方案或安排一次 15 分钟的电话初步探讨吗？';
      }
      return '您好，邮件已收到。关于 ' + subject + '，内容已经审阅并确认，后续我们将推进对应流程并及时与您同步进展。祝好！';
    }

    static renderAnalyzingCard(email, index, total, decision = null, phase = 'email_start') {
      const hasChoice = phase === 'step_choice' || phase === 'step_complete';
      const hasComplete = phase === 'step_complete';

      const progressPct = Math.round(((index + 1) / total) * 100);

      const renderScoreDots = (score) => {
        let dots = '';
        for (let i = 0; i <= 4; i++) {
          const filled = i <= score;
          dots += `<span style="display:inline-block; width:9px; height:9px; border-radius:50%; margin-right:5px; background:${filled ? '#818cf8' : 'rgba(255,255,255,0.15)'}; box-shadow:${filled ? '0 0 8px rgba(129,140,248,0.7)' : 'none'};"></span>`;
        }
        return dots;
      };

      const renderProbBars = (probs) => {
        if (!probs) return '';
        const order = ['VIEW_NOW', 'READ_LATER', 'REPLY', 'ARCHIVE', 'IGNORE'];
        return order.map(k => {
          const p = probs[k] || 0;
          const pct = Math.round(p * 100);
          const meta = ACTION_META[k];
          const isWinner = decision && decision.action && decision.action.value === k;
          return `
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:5px; font-size:11px;">
              <span style="color:${isWinner ? meta.color : '#94a3b8'}; font-weight:${isWinner ? '700' : '400'}; width:68px;">${meta.text}</span>
              <div style="flex:1; height:6px; background:rgba(255,255,255,0.06); border-radius:3px; margin:0 8px; overflow:hidden;">
                <div style="width:${pct}%; height:100%; background:${isWinner ? meta.color : 'rgba(255,255,255,0.2)'}; border-radius:3px; transition:width 0.4s ease;"></div>
              </div>
              <span style="color:${isWinner ? '#f1f5f9' : '#64748b'}; font-family:monospace; width:34px; text-align:right;">${pct}%</span>
            </div>
          `;
        }).join('');
      };

      const winnerMeta = decision && decision.action ? ACTION_META[decision.action.value] || ACTION_META.READ_LATER : null;
      const winnerPct = decision && decision.action && decision.action.probabilities ? Math.round((decision.action.probabilities[decision.action.value] || 0.8) * 100) : 80;

      return `
        <div style="animation:jevFadeIn 0.3s ease;">
          <!-- Progress Header -->
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; font-size:12px;">
            <span style="color:#818cf8; font-weight:700; display:flex; align-items:center; gap:6px;">
              <span class="jev-pulse-dot"></span>
              正在分析 ${index + 1} / ${total}
            </span>
            <span style="color:#64748b; font-family:monospace; font-weight:600;">${progressPct}%</span>
          </div>
          <div style="height:3px; background:rgba(255,255,255,0.08); border-radius:2px; margin-bottom:14px; overflow:hidden;">
            <div style="width:${progressPct}%; height:100%; background:linear-gradient(90deg, #6366f1, #a855f7); transition:width 0.3s ease;"></div>
          </div>

          <!-- Current Email Header Box -->
          <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:10px 12px; margin-bottom:12px;">
            <div style="color:#94a3b8; font-size:11px; margin-bottom:3px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
              ${escapeHtml(email.sender)}
            </div>
            <div style="color:#f8fafc; font-size:13px; font-weight:600; line-height:1.4; margin-bottom:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
              ${escapeHtml(email.subject)}
            </div>
            <div style="color:#64748b; font-size:11px; line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">
              ${escapeHtml(email.snippet || '')}
            </div>
          </div>

          <!-- Decision Sections -->
          <div style="display:flex; flex-direction:column; gap:10px;">
            <!-- Choice Section -->
            <div style="background:rgba(15, 23, 42, 0.65); border:1px solid rgba(255,255,255,0.07); border-radius:8px; padding:10px 12px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <span style="color:#94a3b8; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">Choice · 下一步动作</span>
                ${hasChoice && winnerMeta ? `
                  <span style="font-size:11px; background:${winnerMeta.bg}; color:${winnerMeta.color}; border:1px solid ${winnerMeta.border}; border-radius:4px; padding:2px 8px; font-weight:700;">
                    → ${winnerMeta.text} ${winnerPct}%
                  </span>
                ` : `<span style="color:#64748b; font-size:11px; font-style:italic;">正在判断...</span>`}
              </div>

              ${hasChoice ? `
                <div style="margin-top:8px;">
                  ${renderProbBars(decision.action.probabilities)}
                  <div style="text-align:right; font-size:10px; color:#64748b; margin-top:4px;">
                    Confidence <span style="color:#cbd5e1; font-weight:700;">${Math.round(decision.action.confidence * 100)}%</span>
                  </div>
                </div>
              ` : `
                <div class="jev-skeleton-bar" style="height:14px; margin-top:6px;"></div>
              `}
            </div>

            <!-- Score Section -->
            <div style="background:rgba(15, 23, 42, 0.65); border:1px solid rgba(255,255,255,0.07); border-radius:8px; padding:10px 12px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="color:#94a3b8; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">重要程度 (Score)</span>
                ${hasComplete ? `
                  <div style="display:flex; align-items:center; gap:6px;">
                    ${renderScoreDots(decision.importance.score)}
                    <span style="color:#f1f5f9; font-size:12px; font-weight:700; font-family:monospace; margin-left:4px;">
                      ${decision.importance.score} / 4
                    </span>
                    <span style="color:#94a3b8; font-size:11px;">(${decision.importance.label})</span>
                  </div>
                ` : `<span style="color:#64748b; font-size:11px; font-style:italic;">正在判断...</span>`}
              </div>
            </div>

            <!-- Nouls Section -->
            <div style="background:rgba(15, 23, 42, 0.65); border:1px solid rgba(255,255,255,0.07); border-radius:8px; padding:10px 12px;">
              <div style="color:#94a3b8; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">
                System One Nouls (Parallel)
              </div>

              ${hasComplete ? `
                <div style="display:flex; flex-direction:column; gap:8px;">
                  <!-- Noul 1: Today -->
                  <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px;">
                    <span style="color:#cbd5e1;">今天值得处理？</span>
                    <span style="font-family:monospace; font-weight:700; color:${decision.processToday.probability >= 0.7 ? '#34d399' : '#94a3b8'};">
                      → ${Math.round(decision.processToday.probability * 100)}%
                    </span>
                  </div>

                  <!-- Noul 2: Need LLM (Critical Highlight) -->
                  <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; padding:6px 8px; border-radius:6px; background:${decision.needLLM.probability >= 0.5 ? 'rgba(236, 72, 153, 0.15)' : 'rgba(255,255,255,0.02)'}; border:${decision.needLLM.probability >= 0.5 ? '1px solid rgba(236, 72, 153, 0.4)' : '1px solid transparent'};">
                    <span style="color:${decision.needLLM.probability >= 0.5 ? '#f472b6' : '#cbd5e1'}; font-weight:${decision.needLLM.probability >= 0.5 ? '700' : '400'}; display:flex; align-items:center; gap:5px;">
                      ${decision.needLLM.probability >= 0.5 ? '⚡ 需要 LLM 生成：' : '需要 LLM？'}
                    </span>
                    <div style="display:flex; align-items:center; gap:6px;">
                      <span style="font-family:monospace; font-weight:700; color:${decision.needLLM.probability >= 0.5 ? '#f472b6' : '#94a3b8'};">
                        → ${Math.round(decision.needLLM.probability * 100)}%
                      </span>
                      ${decision.needLLM.probability >= 0.5 ? '<span style="font-size:10px; background:#ec4899; color:#fff; border-radius:3px; padding:1px 5px; font-weight:700;">起草回复</span>' : '<span style="font-size:10px; color:#64748b;">无需生成</span>'}
                    </div>
                  </div>

                  <!-- Noul 3: Promotion -->
                  <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px;">
                    <span style="color:#cbd5e1;">营销推广？</span>
                    <span style="font-family:monospace; font-weight:700; color:${decision.promotion.probability >= 0.7 ? '#f43f5e' : '#94a3b8'};">
                      → ${Math.round(decision.promotion.probability * 100)}%
                    </span>
                  </div>
                </div>
              ` : `
                <div class="jev-skeleton-bar" style="height:12px; margin-bottom:6px;"></div>
                <div class="jev-skeleton-bar" style="height:12px; width:70%;"></div>
              `}
            </div>
          </div>

          <!-- Bottom Status Pill -->
          <div style="margin-top:12px; text-align:center; font-size:11px; color:${hasComplete ? '#34d399' : '#818cf8'}; font-weight:600;">
            ${hasComplete ? '✓ Decision complete' : 'System One evaluating parallel state...'}
          </div>
        </div>
      `;
    }

    static renderSingleEmailView(email, decision, index, total, hasFinishedBatch = false) {
      const winnerMeta = decision && decision.action ? ACTION_META[decision.action.value] || ACTION_META.READ_LATER : null;
      const winnerPct = decision && decision.action && decision.action.probabilities ? Math.round((decision.action.probabilities[decision.action.value] || 0.8) * 100) : 80;

      const renderScoreDots = (score) => {
        let dots = '';
        for (let i = 0; i <= 4; i++) {
          const filled = i <= score;
          dots += `<span style="display:inline-block; width:9px; height:9px; border-radius:50%; margin-right:5px; background:${filled ? '#818cf8' : 'rgba(255,255,255,0.15)'}; box-shadow:${filled ? '0 0 8px rgba(129,140,248,0.7)' : 'none'};"></span>`;
        }
        return dots;
      };

      const renderProbBars = (probs) => {
        if (!probs) return '';
        const order = ['VIEW_NOW', 'READ_LATER', 'REPLY', 'ARCHIVE', 'IGNORE'];
        return order.map(k => {
          const p = probs[k] || 0;
          const pct = Math.round(p * 100);
          const meta = ACTION_META[k];
          const isWinner = decision && decision.action && decision.action.value === k;
          return `
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:5px; font-size:11px;">
              <span style="color:${isWinner ? meta.color : '#94a3b8'}; font-weight:${isWinner ? '700' : '400'}; width:68px;">${meta.text}</span>
              <div style="flex:1; height:6px; background:rgba(255,255,255,0.06); border-radius:3px; margin:0 8px; overflow:hidden;">
                <div style="width:${pct}%; height:100%; background:${isWinner ? meta.color : 'rgba(255,255,255,0.2)'}; border-radius:3px; transition:width 0.4s ease;"></div>
              </div>
              <span style="color:${isWinner ? '#f1f5f9' : '#64748b'}; font-family:monospace; width:34px; text-align:right;">${pct}%</span>
            </div>
          `;
        }).join('');
      };

      return `
        <div style="animation:jevFadeIn 0.3s ease;">
          <!-- Pager & Back Navigation Bar -->
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <button id="jev-btn-back-overview" style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); border-radius:6px; color:#cbd5e1; padding:4px 10px; font-size:11px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:4px; transition:background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.06)'">
              ← ${hasFinishedBatch ? '返回分析看板' : '返回列表'}
            </button>

            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:11px; color:#94a3b8; font-family:monospace;">
                ${index + 1} / ${total}
              </span>
              <div style="display:flex; gap:3px;">
                <button id="jev-btn-prev-email" title="上一封" style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:#cbd5e1; width:22px; height:22px; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:11px;" ${index <= 0 ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : ''}>
                  ◀
                </button>
                <button id="jev-btn-next-email" title="下一封" style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:#cbd5e1; width:22px; height:22px; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:11px;" ${index >= total - 1 ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : ''}>
                  ▶
                </button>
              </div>
            </div>
          </div>

          <!-- Email Details Card -->
          <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:10px 12px; margin-bottom:12px;">
            <div style="color:#94a3b8; font-size:11px; margin-bottom:3px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
              ${escapeHtml(email.sender)}
            </div>
            <div style="color:#f8fafc; font-size:13px; font-weight:700; line-height:1.4; margin-bottom:4px;">
              ${escapeHtml(email.subject)}
            </div>
            <div style="color:#64748b; font-size:11px; line-height:1.4;">
              ${escapeHtml(email.snippet || '')}
            </div>
          </div>

          <!-- Decision Results -->
          <div style="display:flex; flex-direction:column; gap:10px;">
            <!-- Choice -->
            <div style="background:rgba(15, 23, 42, 0.65); border:1px solid rgba(255,255,255,0.07); border-radius:8px; padding:10px 12px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <span style="color:#94a3b8; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">Choice · 下一步动作</span>
                ${winnerMeta ? `
                  <span style="font-size:11px; background:${winnerMeta.bg}; color:${winnerMeta.color}; border:1px solid ${winnerMeta.border}; border-radius:4px; padding:2px 8px; font-weight:700;">
                    → ${winnerMeta.text} ${winnerPct}%
                  </span>
                ` : ''}
              </div>
              <div style="margin-top:8px;">
                ${renderProbBars(decision.action.probabilities)}
                <div style="text-align:right; font-size:10px; color:#64748b; margin-top:4px;">
                  Confidence <span style="color:#cbd5e1; font-weight:700;">${Math.round(decision.action.confidence * 100)}%</span>
                </div>
              </div>
            </div>

            <!-- Score -->
            <div style="background:rgba(15, 23, 42, 0.65); border:1px solid rgba(255,255,255,0.07); border-radius:8px; padding:10px 12px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="color:#94a3b8; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">重要程度 (Score)</span>
                <div style="display:flex; align-items:center; gap:6px;">
                  ${renderScoreDots(decision.importance.score)}
                  <span style="color:#f1f5f9; font-size:12px; font-weight:700; font-family:monospace; margin-left:4px;">
                    ${decision.importance.score} / 4
                  </span>
                  <span style="color:#94a3b8; font-size:11px;">(${decision.importance.label})</span>
                </div>
              </div>
            </div>

            <!-- System One Nouls -->
            <div style="background:rgba(15, 23, 42, 0.65); border:1px solid rgba(255,255,255,0.07); border-radius:8px; padding:10px 12px;">
              <div style="color:#94a3b8; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">
                System One Nouls (Parallel)
              </div>
              <div style="display:flex; flex-direction:column; gap:8px;">
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px;">
                  <span style="color:#cbd5e1;">今天值得处理？</span>
                  <span style="font-family:monospace; font-weight:700; color:${decision.processToday.probability >= 0.7 ? '#34d399' : '#94a3b8'};">
                    → ${Math.round(decision.processToday.probability * 100)}%
                  </span>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; padding:6px 8px; border-radius:6px; background:${decision.needLLM.probability >= 0.5 ? 'rgba(236, 72, 153, 0.15)' : 'rgba(255,255,255,0.02)'}; border:${decision.needLLM.probability >= 0.5 ? '1px solid rgba(236, 72, 153, 0.4)' : '1px solid transparent'};">
                  <span style="color:${decision.needLLM.probability >= 0.5 ? '#f472b6' : '#cbd5e1'}; font-weight:${decision.needLLM.probability >= 0.5 ? '700' : '400'}; display:flex; align-items:center; gap:5px;">
                    ${decision.needLLM.probability >= 0.5 ? '⚡ 需要 LLM 生成：' : '需要 LLM？'}
                  </span>
                  <div style="display:flex; align-items:center; gap:6px;">
                    <span style="font-family:monospace; font-weight:700; color:${decision.needLLM.probability >= 0.5 ? '#f472b6' : '#94a3b8'};">
                      → ${Math.round(decision.needLLM.probability * 100)}%
                    </span>
                    ${decision.needLLM.probability >= 0.5 ? '<span style="font-size:10px; background:#ec4899; color:#fff; border-radius:3px; padding:1px 5px; font-weight:700;">起草回复</span>' : '<span style="font-size:10px; color:#64748b;">无需生成</span>'}
                  </div>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px;">
                  <span style="color:#cbd5e1;">营销推广？</span>
                  <span style="font-family:monospace; font-weight:700; color:${decision.promotion.probability >= 0.7 ? '#f43f5e' : '#94a3b8'};">
                    → ${Math.round(decision.promotion.probability * 100)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
          <!-- LLM Reply Drafting Co-pilot Card -->
          ${(decision.action.value === 'REPLY' || (decision.needLLM && decision.needLLM.probability >= 0.45)) ? `
            <div style="margin-top:12px; background:linear-gradient(135deg, rgba(236,72,153,0.12), rgba(99,102,241,0.12)); border:1px solid rgba(236,72,153,0.35); border-radius:8px; padding:10px 12px;">
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
                <span style="font-size:11px; font-weight:700; color:#f472b6; display:flex; align-items:center; gap:5px;">
                  <span>🤖</span> Jev 触发大模型建议回复
                </span>
                <span style="font-size:10px; background:#ec4899; color:#fff; border-radius:3px; padding:1px 5px; font-weight:700;">Co-pilot Ready</span>
              </div>
              <div id="jev-llm-draft-content" style="font-size:12px; color:#e2e8f0; line-height:1.5; background:rgba(0,0,0,0.3); border-radius:6px; padding:8px 10px; margin-bottom:8px; border:1px solid rgba(255,255,255,0.06); font-family:sans-serif;">
                ${escapeHtml(DecisionRenderer.generateSuggestedDraft(email))}
              </div>
              <button id="jev-btn-fill-draft" style="width:100%; background:linear-gradient(135deg, #ec4899, #db2777); color:#fff; border:none; border-radius:6px; padding:8px 0; font-size:12px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; box-shadow:0 2px 10px rgba(236,72,153,0.3); transition:all 0.2s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
                ✍️ 一键填入 Gmail 回复框
              </button>
            </div>
          ` : ''}

          <!-- Quick Action Button -->
          <div style="margin-top:14px;">
            <button id="jev-btn-start-from-single" style="width:100%; background:linear-gradient(135deg, #6366f1, #4f46e5); color:#fff; border:none; border-radius:8px; padding:10px 0; font-size:13px; font-weight:700; cursor:pointer; box-shadow:0 4px 14px rgba(99,102,241,0.3); transition:all 0.2s;" onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='translateY(0)'">
              ${hasFinishedBatch ? '查看分析总看板 (Summary)' : '▶ 开始全量批量分析'}
            </button>
          </div>
        </div>
      `;
    }
  }

  /* ==========================================================================
     8. SummaryRenderer
     Renders the high-impact summary dashboard shown at the end of the demo.
     ========================================================================== */
  class SummaryRenderer {
    static render(results) {
      const totalEmails = results.length;
      const totalDecisions = totalEmails * 5; // Choice + Score + 3 Nouls
      const needLLMCount = results.filter(r => r.decision.needLLM.probability >= 0.5).length;
      const fallbackCount = results.filter(r => r.decision.meta && r.decision.meta.source === 'local-fallback').length;
      const savedLLMCount = totalEmails - needLLMCount;
      const savedPercent = Math.round((savedLLMCount / totalEmails) * 100);

      const actionCounts = {
        VIEW_NOW: 0,
        READ_LATER: 0,
        REPLY: 0,
        ARCHIVE: 0,
        IGNORE: 0
      };

      results.forEach(r => {
        const val = r.decision.action.value;
        if (actionCounts[val] !== undefined) {
          actionCounts[val]++;
        }
      });

      return `
        <div style="animation:jevFadeIn 0.4s ease;">
          <!-- Top Badge -->
          <div style="text-align:center; margin-bottom:12px;">
            <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(52, 211, 153, 0.12); border:1px solid rgba(52, 211, 153, 0.35); border-radius:20px; padding:3px 12px; font-size:12px; color:#34d399; font-weight:700;">
              <span>✓</span> 分析完成 · 全量决策已就绪
            </div>
          </div>

          ${fallbackCount > 0 ? `
            <div style="background:rgba(245,158,11,0.12); border:1px solid rgba(245,158,11,0.4); color:#fbbf24; border-radius:8px; padding:8px 10px; margin-bottom:12px; font-size:11px; line-height:1.45;">
              ⚠ ${fallbackCount} 封邮件因 Jev API 调用或响应校验失败，使用了本地规则降级。打开浏览器控制台可查看具体错误；这些结果不应当作 Jev 的真实输出。
            </div>
          ` : ''}

          <!-- 3 Hero Metric Cards (Exact Prompt Requirement) -->
          <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:8px; margin-bottom:12px;">
            <div style="background:rgba(15, 23, 42, 0.65); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:12px 6px; text-align:center;">
              <div style="font-size:24px; font-weight:800; color:#f8fafc; font-family:monospace; line-height:1.1;">
                ${totalEmails}
              </div>
              <div style="font-size:11px; color:#94a3b8; margin-top:4px; font-weight:500;">Emails</div>
            </div>

            <div style="background:rgba(15, 23, 42, 0.65); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:12px 6px; text-align:center;">
              <div style="font-size:24px; font-weight:800; color:#818cf8; font-family:monospace; line-height:1.1;">
                ${totalDecisions}
              </div>
              <div style="font-size:11px; color:#94a3b8; margin-top:4px; font-weight:500;">Decisions</div>
            </div>

            <div style="background:rgba(236, 72, 153, 0.15); border:1px solid rgba(236, 72, 153, 0.4); border-radius:8px; padding:12px 6px; text-align:center;">
              <div style="font-size:24px; font-weight:800; color:#f472b6; font-family:monospace; line-height:1.1;">
                ${needLLMCount}
              </div>
              <div style="font-size:11px; color:#f472b6; font-weight:700; margin-top:4px;">Need LLM</div>
            </div>
          </div>

          <!-- Key Philosophy Highlight Banner -->
          <div style="background:linear-gradient(135deg, rgba(99, 102, 241, 0.16), rgba(168, 85, 247, 0.16)); border:1px solid rgba(168, 85, 247, 0.35); border-radius:8px; padding:10px 12px; margin-bottom:12px;">
            <div style="display:flex; align-items:center; gap:6px; color:#c084fc; font-size:12px; font-weight:700; margin-bottom:4px;">
              <span>💡</span> 决策层核心原则
            </div>
            <div style="color:#e2e8f0; font-size:12px; line-height:1.5;">
              <b>LLM 负责生成，Jev 负责决定什么时候值得生成。</b><br>
              并非 ${totalEmails} 封邮件都要调用 ${totalEmails} 次大模型。大量小判断交给 Jev，仅对需要回复的 <b>${needLLMCount}</b> 封邮件唤醒 LLM，避免了 <b>${savedLLMCount}</b> 次昂贵调用（节省 <b>${savedPercent}%</b> 开销）。
            </div>
          </div>

          <!-- Actions Breakdown Table -->
          <div style="background:rgba(15, 23, 42, 0.65); border:1px solid rgba(255,255,255,0.06); border-radius:8px; padding:10px 12px; margin-bottom:12px;">
            <div style="color:#94a3b8; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">
              分流统计 (Action Breakdown)
            </div>

            <div style="display:flex; flex-direction:column; gap:6px;">
              ${Object.keys(ACTION_META).map(k => {
                const count = actionCounts[k] || 0;
                const meta = ACTION_META[k];
                const pct = totalEmails > 0 ? Math.round((count / totalEmails) * 100) : 0;
                const isReply = k === 'REPLY';
                return `
                  <div style="display:flex; align-items:center; justify-content:space-between; font-size:12px;">
                    <div style="display:flex; align-items:center; gap:6px;">
                      <span style="display:inline-block; width:8px; height:8px; border-radius:2px; background:${meta.color};"></span>
                      <span style="color:#e2e8f0; font-weight:${count > 0 ? '600' : '400'};">${meta.text}</span>
                      ${isReply && count > 0 ? '<span style="font-size:10px; background:#ec4899; color:#fff; border-radius:3px; padding:1px 5px; font-weight:700;">起草回复</span>' : ''}
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                      <span style="color:#64748b; font-size:11px;">${pct}%</span>
                      <span style="color:#f8fafc; font-family:monospace; font-weight:700; width:18px; text-align:right;">${count}</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Processed Emails Mini Drilldown -->
          <div style="background:rgba(15, 23, 42, 0.65); border:1px solid rgba(255,255,255,0.06); border-radius:8px; padding:10px 12px; margin-bottom:14px;">
            <div style="color:#94a3b8; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">
              已处理邮件列表 (${results.length} 封 · 点击高亮对应邮件)
            </div>
            <div style="max-height:150px; overflow-y:auto; display:flex; flex-direction:column; gap:5px; padding-right:4px;">
              ${results.map((r, i) => {
                const meta = ACTION_META[r.decision.action.value] || ACTION_META.READ_LATER;
                const needLLM = r.decision.needLLM.probability >= 0.5;
                return `
                  <div class="jev-summary-row" data-index="${i}" style="display:flex; align-items:center; justify-content:space-between; padding:5px 8px; border-radius:5px; background:rgba(255,255,255,0.02); font-size:11px; cursor:pointer;">
                    <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding-right:8px; color:#cbd5e1;">
                      <span style="color:#64748b; margin-right:4px;">#${i + 1}</span>
                      ${escapeHtml(r.email.subject || r.email.sender)}
                    </div>
                    <div style="display:flex; align-items:center; gap:4px; flex-shrink:0;">
                      ${needLLM ? '<span style="font-size:9px; color:#f472b6; border:1px solid rgba(236,72,153,0.4); border-radius:3px; padding:0 3px; font-weight:700;">LLM</span>' : ''}
                      <span style="color:${meta.color}; background:${meta.bg}; padding:1px 6px; border-radius:4px; font-weight:700; font-size:10px;">
                        ${meta.text}
                      </span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Bottom Actions -->
          <div style="display:flex; gap:8px;">
            <button id="jev-btn-restart" style="flex:1; background:linear-gradient(135deg, #6366f1, #4f46e5); color:#fff; border:none; border-radius:6px; padding:9px 0; font-size:13px; font-weight:700; cursor:pointer; transition:opacity 0.2s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
              ↺ 重新分析
            </button>
            <button id="jev-btn-export" style="background:rgba(255,255,255,0.06); color:#cbd5e1; border:1px solid rgba(255,255,255,0.1); border-radius:6px; padding:9px 12px; font-size:12px; cursor:pointer; transition:background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.06)'">
              导出 JSON
            </button>
          </div>
        </div>
      `;
    }
  }

  /* ==========================================================================
     9. FloatingPanel
     Floating, draggable, minimizable glassmorphism UI container.
     ========================================================================== */
  class FloatingPanel {
    constructor() {
      this.container = null;
      this.isMinimized = false;
      this.mode = 'docked'; // 'docked' | 'floating'
      this.currentOpenEmailId = null;
      this.engineType = CONFIG.USE_MOCK ? 'mock' : 'real'; // 'mock' | 'real'
      this.speed = 'normal'; // 'normal' | 'fast'
      this.engine = new DecisionEngine();
      this.cachedEmails = (typeof window !== 'undefined' && window.JEV_DEMO_EMAILS) ? window.JEV_DEMO_EMAILS : [];
    }

    init() {
      this.injectStyles();
      this.createDOM();
      this.bindEvents();
      this.updateDetectedEmails();
    }

    injectStyles() {
      const css = `
        @keyframes jevFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes jevPulse {
          0% { transform: scale(0.95); opacity: 0.8; }
          50% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0.8; }
        }
        .jev-pulse-dot {
          display: inline-block;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #34d399;
          box-shadow: 0 0 8px #34d399;
          animation: jevPulse 1.5s infinite ease-in-out;
        }
        .jev-skeleton-bar {
          background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.04) 75%);
          background-size: 200% 100%;
          border-radius: 4px;
          animation: jevSkeleton 1.4s infinite ease-in-out;
        }
        @keyframes jevSkeleton {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        /* Default: Docked Sidebar Mode (Gmail Companion Native Style) */
        #${CONFIG.CONTAINER_ID} {
          position: fixed;
          top: 64px;
          right: 0;
          width: 385px;
          height: calc(100vh - 64px);
          max-height: calc(100vh - 64px);
          background: rgba(13, 15, 23, 0.96);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-right: none;
          border-radius: 16px 0 0 16px;
          box-shadow: -10px 0 35px rgba(0, 0, 0, 0.45), 0 0 20px rgba(99, 102, 241, 0.12);
          color: #f8fafc;
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", "Segoe UI", Roboto, sans-serif;
          z-index: 999999;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease, width 0.25s ease;
        }

        #${CONFIG.CONTAINER_ID}.jev-docked {
          top: 64px !important;
          right: 0 !important;
          left: auto !important;
          width: 385px;
          height: calc(100vh - 64px);
          max-height: calc(100vh - 64px);
          border-right: none;
          border-radius: 16px 0 0 16px;
        }

        /* Floating Mode (Free Draggable Card) */
        #${CONFIG.CONTAINER_ID}.jev-floating {
          top: 80px;
          right: 24px;
          width: 410px;
          height: auto;
          max-height: 86vh;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 14px;
          box-shadow: 0 16px 40px -10px rgba(0, 0, 0, 0.65), 0 0 30px rgba(99, 102, 241, 0.15);
        }

        /* Row Badges injected in Gmail inbox rows */
        .jev-row-badge {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          margin-left: 8px;
          margin-right: 6px;
          padding: 2px 7px;
          font-size: 11px;
          font-weight: 600;
          border-radius: 4px;
          cursor: pointer;
          vertical-align: middle;
          white-space: nowrap;
          transition: all 0.15s ease;
          user-select: none;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .jev-row-badge:hover {
          transform: scale(1.06);
          filter: brightness(1.15);
        }

        /* Pinned Edge Tab Launcher */
        #jev-trigger-pill {
          position: fixed;
          right: 0;
          top: 48%;
          transform: translateY(-50%);
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.25);
          border-right: none;
          border-radius: 12px 0 0 12px;
          padding: 10px 14px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          z-index: 999998;
          display: none;
          box-shadow: -4px 0 18px rgba(79, 70, 229, 0.45);
          transition: all 0.2s ease;
          align-items: center;
          gap: 6px;
          user-select: none;
        }
        #jev-trigger-pill:hover {
          padding-left: 18px;
          box-shadow: -6px 0 26px rgba(99, 102, 241, 0.65);
        }
      `;

      if (typeof GM_addStyle === 'function') {
        GM_addStyle(css);
      } else {
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
      }
    }

    createDOM() {
      this.container = document.createElement('div');
      this.container.id = CONFIG.CONTAINER_ID;
      this.container.classList.add(this.mode === 'docked' ? 'jev-docked' : 'jev-floating');
      safeSetHTML(this.container, `
        <!-- Header Bar (Draggable) -->
        <div id="jev-header" style="display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.08); cursor:grab; user-select:none;">
          <div style="display:flex; align-items:center; gap:8px;">
            <div style="width:24px; height:24px; border-radius:6px; background:linear-gradient(135deg, #6366f1, #a855f7); display:flex; align-items:center; justify-content:center; font-weight:800; font-size:12px; color:#fff; box-shadow:0 0 10px rgba(99,102,241,0.5);">
              J
            </div>
            <div>
              <div style="font-weight:700; font-size:13px; letter-spacing:0.3px; color:#f8fafc; line-height:1.2;">
                Jev · Inbox Decision
              </div>
              <div style="font-size:10px; color:#818cf8; font-weight:500;">
                System One · AI Decision Layer
              </div>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:5px;">
            <button id="jev-btn-settings" title="API Key 设置" style="background:none; border:none; color:#94a3b8; font-size:13px; cursor:pointer; width:22px; height:22px; display:flex; align-items:center; justify-content:center; border-radius:4px; transition:color 0.2s;">
              ⚙️
            </button>
            <button id="jev-btn-mode" title="当前：贴靠侧栏模式 (点击切换为自由悬浮)" style="background:none; border:none; color:#94a3b8; font-size:13px; cursor:pointer; width:22px; height:22px; display:flex; align-items:center; justify-content:center; border-radius:4px; transition:color 0.2s;">
              ⇥
            </button>
            <button id="jev-btn-min" title="最小化" style="background:none; border:none; color:#94a3b8; font-size:16px; cursor:pointer; width:22px; height:22px; display:flex; align-items:center; justify-content:center; border-radius:4px; transition:color 0.2s;">
              −
            </button>
            <button id="jev-btn-close" title="关闭" style="background:none; border:none; color:#94a3b8; font-size:16px; cursor:pointer; width:22px; height:22px; display:flex; align-items:center; justify-content:center; border-radius:4px; transition:color 0.2s;">
              ×
            </button>
          </div>
        </div>

        <!-- Settings Drawer (Collapsible) -->
        <div id="jev-settings-drawer" style="display:none; padding:10px 16px; background:rgba(15, 23, 42, 0.96); border-bottom:1px solid rgba(255,255,255,0.08); font-size:11px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <span style="font-weight:700; color:#f8fafc; display:flex; align-items:center; gap:5px;">
              <span>🔑</span> Jev API Key 设置
            </span>
            <span id="jev-drawer-status" style="font-size:10px; color:${Storage.hasApiKey() ? '#34d399' : '#f59e0b'}; font-weight:600;">
              ${Storage.hasApiKey() ? '✓ 已就绪' : '⚠ 未配置'}
            </span>
          </div>
          <div style="display:flex; gap:6px; margin-bottom:6px;">
            <input type="password" id="jev-drawer-api-key" placeholder="输入 apikey_..." value="${escapeHtml(Storage.getApiKey())}" style="flex:1; background:rgba(0,0,0,0.45); border:1px solid rgba(255,255,255,0.15); border-radius:6px; padding:6px 8px; color:#fff; font-size:11px; font-family:monospace; outline:none;" />
            <button id="jev-btn-toggle-mask" title="显示/隐藏" style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); border-radius:6px; color:#cbd5e1; width:28px; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:11px;">👁</button>
            <button id="jev-btn-save-drawer-key" style="background:linear-gradient(135deg, #6366f1, #4f46e5); color:#fff; border:none; border-radius:6px; padding:0 12px; font-weight:700; font-size:11px; cursor:pointer;">保存</button>
          </div>
          <div style="font-size:10px; color:#94a3b8; display:flex; justify-content:space-between; align-items:center;">
            <span>安全存储在本地浏览器，不会外泄</span>
            <span id="jev-btn-clear-key" style="color:#f87171; cursor:pointer; text-decoration:underline;">清除 Key</span>
          </div>
        </div>

        <!-- Status & Controls Bar -->
        <div id="jev-toolbar" style="display:flex; align-items:center; justify-content:space-between; padding:8px 16px; background:rgba(0,0,0,0.25); border-bottom:1px solid rgba(255,255,255,0.05); font-size:11px;">
          <!-- Model Status Badge -->
          <div style="display:flex; align-items:center; gap:6px;">
            <span class="jev-pulse-dot"></span>
            <span style="color:#818cf8; font-weight:600; font-family:monospace; font-size:11px;">jev-latest</span>
            <span style="color:rgba(255,255,255,0.2);">|</span>
            <span id="jev-status-count" style="color:#94a3b8; font-size:11px;">${this.cachedEmails.length > 0 ? this.cachedEmails.length + " 封待办就绪" : "准备就绪"}</span>
          </div>

          <!-- Status Controls -->
          <div style="display:flex; align-items:center; gap:6px;">
            <button id="jev-toggle-engine" title="Jev System One 决策引擎已连接" style="background:rgba(52, 211, 153, 0.12); border:1px solid rgba(52, 211, 153, 0.35); border-radius:4px; color:#34d399; padding:2px 8px; font-size:10px; cursor:pointer; transition:all 0.15s; font-weight:600;">
              Jev API
            </button>
          </div>
        </div>

        <!-- Dynamic Body Area -->
        <div id="jev-body" style="padding:16px; overflow-y:auto; flex:1;"></div>
      `);

      document.body.appendChild(this.container);

      // Add persistent trigger pill if closed
      const pill = document.createElement('div');
      pill.id = 'jev-trigger-pill';
      safeSetHTML(pill, `
        <span style="font-size:13px;">⚡</span>
        <span>Jev 助手</span>
        <span id="jev-pill-count" style="background:rgba(255,255,255,0.25); border-radius:10px; padding:1px 6px; font-size:10px; font-family:monospace; margin-left:2px;">${this.cachedEmails.length}</span>
      `);
      pill.onclick = () => {
        this.container.style.display = 'flex';
        pill.style.display = 'none';
      };
      document.body.appendChild(pill);

      this.renderIdleView();
    }

    renderIdleView() {
      const emailCount = this.cachedEmails.length;
      const body = this.container.querySelector('#jev-body');
      if (!body) return;

      const hasKey = Storage.hasApiKey();
      const currentKey = Storage.getApiKey();

      safeSetHTML(body, `
        <div style="animation:jevFadeIn 0.3s ease;">
          <div style="text-align:center; padding:12px 0 16px;">
            <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(99,102,241,0.15); border:1px solid rgba(99,102,241,0.3); border-radius:16px; padding:3px 10px; font-size:11px; color:#818cf8; font-weight:600; margin-bottom:12px;">
              <span class="jev-pulse-dot"></span>
              Jev System One Ready
            </div>
            <div style="font-size:18px; font-weight:700; color:#f8fafc; margin-bottom:6px;">
              检测到 <span id="jev-email-count" style="color:#818cf8; font-family:monospace; font-size:24px;">${emailCount}</span> 封邮件
            </div>
            <div style="font-size:12px; color:#94a3b8; max-width:320px; margin:0 auto; line-height:1.5;">
              以 Jev 作为智能体决策层，精准预测动作分流与大模型调用必要性。
            </div>
          </div>

          <!-- Feature Bullets -->
          <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); border-radius:8px; padding:10px 12px; margin-bottom:14px; font-size:11px; color:#cbd5e1; display:flex; flex-direction:column; gap:6px;">
            <div style="display:flex; align-items:center; gap:6px;">
              <span style="color:#38bdf8;">◈</span> Choice：5 种下一步动作置信度评估
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
              <span style="color:#818cf8;">◈</span> Score：0~4 级价值权重与排序打分
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
              <span style="color:#f472b6;">◈</span> Nouls：并行判断即时处理、大模型介入与营销属性
            </div>
          </div>

          <!-- API Key Section in Idle View -->
          <div id="jev-idle-key-card" style="background:rgba(255,255,255,0.03); border:1px solid ${hasKey ? 'rgba(255,255,255,0.08)' : 'rgba(245,158,11,0.45)'}; border-radius:8px; padding:10px 12px; margin-bottom:14px; transition:all 0.3s ease;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <span style="font-size:11px; font-weight:600; color:#cbd5e1; display:flex; align-items:center; gap:5px;">
                <span>🔑</span> Jev API Key
              </span>
              <span id="jev-idle-key-status" style="font-size:10px; color:${hasKey ? '#34d399' : '#f59e0b'}; font-weight:600;">
                ${hasKey ? '✓ 已就绪' : '⚠ 待填写 (真实分析必需)'}
              </span>
            </div>
            <div style="display:flex; gap:6px;">
              <input type="password" id="jev-idle-input-key" placeholder="输入 apikey_..." value="${escapeHtml(currentKey)}" style="flex:1; background:rgba(0,0,0,0.35); border:1px solid rgba(255,255,255,0.12); border-radius:6px; padding:6px 8px; color:#fff; font-size:11px; font-family:monospace; outline:none;" />
              <button id="jev-idle-btn-mask" title="显示/隐藏" style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); border-radius:6px; color:#cbd5e1; width:28px; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:11px;">👁</button>
              <button id="jev-idle-btn-save" style="background:linear-gradient(135deg, #6366f1, #4f46e5); color:#fff; border:none; border-radius:6px; padding:0 12px; font-weight:700; font-size:11px; cursor:pointer;">保存</button>
            </div>
          </div>

          <!-- CTA Button -->
          <button id="jev-btn-start" style="width:100%; background:linear-gradient(135deg, #6366f1, #4f46e5); color:#fff; border:none; border-radius:8px; padding:12px 0; font-size:14px; font-weight:700; cursor:pointer; box-shadow:0 4px 16px rgba(99,102,241,0.35); transition:all 0.2s;" onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='translateY(0)'">
            ▶ 开始分析
          </button>
        </div>
      `);

      const startBtn = body.querySelector('#jev-btn-start');
      if (startBtn) {
        startBtn.onclick = () => this.startAnalysis();
      }

      this.bindIdleKeyEvents();
    }

    bindIdleKeyEvents() {
      const idleInput = this.container.querySelector('#jev-idle-input-key');
      const maskBtn = this.container.querySelector('#jev-idle-btn-mask');
      const saveBtn = this.container.querySelector('#jev-idle-btn-save');

      if (maskBtn && idleInput) {
        maskBtn.onclick = () => {
          idleInput.type = idleInput.type === 'password' ? 'text' : 'password';
          maskBtn.textContent = idleInput.type === 'password' ? '👁' : '🙈';
        };
      }

      if (saveBtn && idleInput) {
        saveBtn.onclick = () => {
          this.handleSaveApiKey(idleInput.value, saveBtn);
        };
        idleInput.onkeydown = (e) => {
          if (e.key === 'Enter') {
            this.handleSaveApiKey(idleInput.value, saveBtn);
          }
        };
      }
    }

    handleSaveApiKey(rawVal, triggerBtn = null) {
      const trimmed = Storage.setApiKey(rawVal);
      this.syncApiKeyUI();
      if (triggerBtn) {
        const originalText = triggerBtn.textContent;
        triggerBtn.textContent = '✓ 已保存';
        triggerBtn.style.background = '#10b981';
        setTimeout(() => {
          triggerBtn.textContent = originalText;
          triggerBtn.style.background = 'linear-gradient(135deg, #6366f1, #4f46e5)';
        }, 1800);
      }
    }

    syncApiKeyUI() {
      const hasKey = Storage.hasApiKey();
      const currentKey = Storage.getApiKey();

      // Drawer
      const drawerInput = this.container.querySelector('#jev-drawer-api-key');
      if (drawerInput) drawerInput.value = currentKey;
      const drawerStatus = this.container.querySelector('#jev-drawer-status');
      if (drawerStatus) {
        drawerStatus.textContent = hasKey ? '✓ 已就绪' : '⚠ 未配置';
        drawerStatus.style.color = hasKey ? '#34d399' : '#f59e0b';
      }

      // Idle View
      const idleInput = this.container.querySelector('#jev-idle-input-key');
      if (idleInput) idleInput.value = currentKey;
      const idleStatus = this.container.querySelector('#jev-idle-key-status');
      if (idleStatus) {
        idleStatus.textContent = hasKey ? '✓ 已就绪' : '⚠ 待填写 (真实分析必需)';
        idleStatus.style.color = hasKey ? '#34d399' : '#f59e0b';
      }
      const idleCard = this.container.querySelector('#jev-idle-key-card');
      if (idleCard) {
        idleCard.style.borderColor = hasKey ? 'rgba(255,255,255,0.08)' : 'rgba(245,158,11,0.45)';
      }
    }

    updateDetectedEmails() {
      const visible = GmailDomAdapter.getVisibleEmails();
      if (visible.length > 0) {
        this.cachedEmails = visible;
      } else if (typeof window !== 'undefined' && Array.isArray(window.JEV_DEMO_EMAILS) && window.JEV_DEMO_EMAILS.length > 0) {
        this.cachedEmails = window.JEV_DEMO_EMAILS;
      } else {
        this.cachedEmails = [];
      }

      const countEl = this.container.querySelector('#jev-email-count');
      if (countEl) {
        countEl.textContent = this.cachedEmails.length;
      }
      const statusCountEl = this.container.querySelector('#jev-status-count');
      if (statusCountEl) {
        statusCountEl.textContent = `${this.cachedEmails.length} 封待办就绪`;
      }
    }

    
    showSummaryOverview() {
      const body = this.container.querySelector('#jev-body');
      if (body && this.engine.results.length > 0) {
        safeSetHTML(body, SummaryRenderer.render(this.engine.results));
        this.bindSummaryEvents(this.engine.results);
      }
    }

    startAnalysis() {
      if (this.engineType === 'real' && !Storage.hasApiKey()) {
        const drawer = this.container.querySelector('#jev-settings-drawer');
        if (drawer) drawer.style.display = 'block';
        const input = this.container.querySelector('#jev-drawer-api-key') || this.container.querySelector('#jev-idle-input-key');
        if (input) {
          input.focus();
          input.style.borderColor = '#f59e0b';
        }
        alert('请先填写 Jev API Key 并保存后再开始真实分析！\n\n您可以在浮窗中直接输入 API Key。');
        return;
      }

      this.updateDetectedEmails();
      if (this.cachedEmails.length === 0) {
        alert('当前页面未检测到可见邮件！请确保收件箱中有邮件展示。');
        return;
      }

      const body = this.container.querySelector('#jev-body');
      const toolbar = this.container.querySelector('#jev-toolbar');
      if (toolbar) toolbar.style.opacity = '0.5';

      let currentPhase = 'email_start';
      let currentDecision = null;

      this.engine.onProgress = ({ phase, index, total, email, decision }) => {
        currentPhase = phase;
        if (decision) currentDecision = decision;
        if (body) {
          safeSetHTML(body, DecisionRenderer.renderAnalyzingCard(email, index, total, currentDecision, currentPhase));
        }
      };

      this.engine.onComplete = (results) => {
        if (toolbar) toolbar.style.opacity = '1';
        if (body) {
          safeSetHTML(body, SummaryRenderer.render(results));
          this.bindSummaryEvents(results);
        }
      };

      const delay = this.speed === 'fast' ? 600 : CONFIG.ANIMATION_DELAY_MS;
      this.engine.run(this.cachedEmails, this.engineType, delay);
    }

    bindSummaryEvents(results) {
      const restartBtn = this.container.querySelector('#jev-btn-restart');
      if (restartBtn) {
        restartBtn.onclick = () => this.renderIdleView();
      }

      const exportBtn = this.container.querySelector('#jev-btn-export');
      if (exportBtn) {
        exportBtn.onclick = () => {
          const jsonStr = JSON.stringify(results, null, 2);
          const blob = new Blob([jsonStr], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `jev-decision-report-${Date.now()}.json`;
          a.click();
          URL.revokeObjectURL(url);
        };
      }

      const rows = this.container.querySelectorAll('.jev-summary-row');
      rows.forEach(r => {
        r.onclick = () => {
          const idx = parseInt(r.getAttribute('data-index'), 10);
          const item = results[idx];
          if (item) {
            this.showEmailDecision(item.email.id, true);
          }
        };
      });
    }

    async showEmailDecision(emailId, notifyMainView = true, providedEmail = null) {
      if (!emailId) return;

      // Mark row as read in DOM
      GmailDomAdapter.markAsRead(emailId);

      // Ensure panel is visible and expanded
      this.container.style.display = 'flex';
      const pill = document.getElementById('jev-trigger-pill');
      if (pill) pill.style.display = 'none';

      if (this.isMinimized) {
        this.isMinimized = false;
        this.container.classList.remove('jev-minimized');
        this.container.querySelector('#jev-toolbar').style.display = 'flex';
        this.container.querySelector('#jev-body').style.display = 'block';
        const minBtn = this.container.querySelector('#jev-btn-min');
        if (minBtn) {
          minBtn.textContent = '−';
          minBtn.title = '最小化';
        }
      }

      // Highlight in Gmail DOM
      GmailDomAdapter.clearAllHighlights();
      GmailDomAdapter.highlightEmail(emailId);

      // Refresh detected emails list if empty
      if (this.cachedEmails.length === 0) {
        this.updateDetectedEmails();
      }

      let email = this.cachedEmails.find(e => e.id === emailId);
      if (!email && providedEmail) {
        email = providedEmail;
      }
      if (!email) {
        const demoList = (typeof window !== 'undefined' && window.JEV_DEMO_EMAILS) || [];
        email = demoList.find(e => e.id === emailId);
      }
      if (email) {
        email.unread = false;
      }

      // Sync with main detail view if in standalone demo
      if (notifyMainView && typeof window.openEmailDetail === 'function') {
        window.openEmailDetail(emailId, true);
      }
      if (!email) {
        const row = GmailDomAdapter.findEmailRow(emailId);
        if (row) {
          email = {
            id: emailId,
            sender: row.querySelector('.yP, .zF, span[email], .bA4 span')?.textContent?.trim() || '未知发件人',
            subject: row.querySelector('span.bog, .bqe')?.textContent?.trim() || '(无主题)',
            snippet: row.querySelector('span.y2')?.textContent?.trim() || '',
            unread: row.classList.contains('zE'),
            starred: !!row.querySelector('.starred, .T-KT-Jp')
          };
        }
      }
      if (!email) return;

      let index = this.cachedEmails.findIndex(e => e.id === email.id);
      if (index === -1) index = 0;

      // Check if already evaluated in results
      let record = this.engine.results.find(r => r.email.id === email.id);
      let decision = record ? record.decision : null;

      const body = this.container.querySelector('#jev-body');

      if (!decision) {
        if (this.engineType === 'real' && !Storage.hasApiKey()) {
          const drawer = this.container.querySelector('#jev-settings-drawer');
          if (drawer) drawer.style.display = 'block';
          alert('请先在浮窗上方 ⚙️ 设置中输入并保存 Jev API Key！');
          return;
        }
        safeSetHTML(body, DecisionRenderer.renderAnalyzingCard(email, index, this.cachedEmails.length || 18, null, 'email_start'));
        try {
          if (this.engineType === 'real') {
            decision = await RealJevClient.analyzeEmail(email);
          } else {
            decision = await MockJevClient.analyzeEmail(email);
          }
        } catch (e) {
          decision = await MockJevClient.analyzeEmail(email);
        }
        this.engine.results.push({ email, decision });
      }

      GmailDomAdapter.injectRowBadge(email.id, decision);

      const hasFinishedBatch = this.engine.results.length >= this.cachedEmails.length && this.cachedEmails.length > 0;
      safeSetHTML(body, DecisionRenderer.renderSingleEmailView(
        email,
        decision,
        index,
        this.cachedEmails.length || 18,
        hasFinishedBatch
      ));

      this.bindSingleViewEvents(index);
    }

    bindSingleViewEvents(currentIndex) {
      const backBtn = this.container.querySelector('#jev-btn-back-overview');
      if (backBtn) {
        backBtn.onclick = () => {
          GmailDomAdapter.clearAllHighlights();
          if (this.engine.results.length >= this.cachedEmails.length && this.engine.results.length > 0) {
            const body = this.container.querySelector('#jev-body');
            safeSetHTML(body, SummaryRenderer.render(this.engine.results));
            this.bindSummaryEvents(this.engine.results);
          } else {
            this.renderIdleView();
          }
        };
      }

      const prevBtn = this.container.querySelector('#jev-btn-prev-email');
      if (prevBtn) {
        prevBtn.onclick = () => {
          if (currentIndex > 0) {
            const prevEmail = this.cachedEmails[currentIndex - 1];
            if (prevEmail) this.showEmailDecision(prevEmail.id, true);
          }
        };
      }

      const nextBtn = this.container.querySelector('#jev-btn-next-email');
      if (nextBtn) {
        nextBtn.onclick = () => {
          if (currentIndex < this.cachedEmails.length - 1) {
            const nextEmail = this.cachedEmails[currentIndex + 1];
            if (nextEmail) this.showEmailDecision(nextEmail.id, true);
          }
        };
      }

      
      const fillDraftBtn = this.container.querySelector('#jev-btn-fill-draft');
      if (fillDraftBtn) {
        fillDraftBtn.onclick = () => {
          const draftText = this.container.querySelector('#jev-llm-draft-content')?.textContent?.trim();
          if (draftText) {
            const ok = GmailDomAdapter.fillDraftIntoGmailReply(draftText);
            fillDraftBtn.textContent = ok ? '✓ 已填入 Gmail 回复框！' : '✓ 已复制草稿文本';
            fillDraftBtn.style.background = '#10b981';
            setTimeout(() => {
              fillDraftBtn.textContent = '✍️ 一键填入 Gmail 回复框';
              fillDraftBtn.style.background = 'linear-gradient(135deg, #ec4899, #db2777)';
            }, 2500);
          }
        };
      }

      const startBatchBtn = this.container.querySelector('#jev-btn-start-from-single');
      if (startBatchBtn) {
        startBatchBtn.onclick = () => {
          if (this.engine.results.length >= this.cachedEmails.length && this.engine.results.length > 0) {
            const body = this.container.querySelector('#jev-body');
            safeSetHTML(body, SummaryRenderer.render(this.engine.results));
            this.bindSummaryEvents(this.engine.results);
          } else {
            this.startAnalysis();
          }
        };
      }
    }

    bindEvents() {
      // Settings Button & Drawer Toggle
      const settingsBtn = this.container.querySelector('#jev-btn-settings');
      const drawer = this.container.querySelector('#jev-settings-drawer');
      if (settingsBtn && drawer) {
        settingsBtn.onclick = () => {
          const isShown = drawer.style.display !== 'none';
          drawer.style.display = isShown ? 'none' : 'block';
          if (!isShown) {
            const input = drawer.querySelector('#jev-drawer-api-key');
            if (input) input.focus();
          }
        };
      }

      // Drawer Mask Toggle
      const drawerMaskBtn = this.container.querySelector('#jev-btn-toggle-mask');
      const drawerInput = this.container.querySelector('#jev-drawer-api-key');
      if (drawerMaskBtn && drawerInput) {
        drawerMaskBtn.onclick = () => {
          drawerInput.type = drawerInput.type === 'password' ? 'text' : 'password';
          drawerMaskBtn.textContent = drawerInput.type === 'password' ? '👁' : '🙈';
        };
      }

      // Drawer Save Button
      const drawerSaveBtn = this.container.querySelector('#jev-btn-save-drawer-key');
      if (drawerSaveBtn && drawerInput) {
        drawerSaveBtn.onclick = () => {
          this.handleSaveApiKey(drawerInput.value, drawerSaveBtn);
        };
        drawerInput.onkeydown = (e) => {
          if (e.key === 'Enter') {
            this.handleSaveApiKey(drawerInput.value, drawerSaveBtn);
          }
        };
      }

      // Clear Key
      const clearBtn = this.container.querySelector('#jev-btn-clear-key');
      if (clearBtn) {
        clearBtn.onclick = () => {
          Storage.clearApiKey();
          this.syncApiKeyUI();
          alert('已清除本地存储的 Jev API Key');
        };
      }

      // Mode Toggle (Docked Sidebar vs. Free Floating)
      const modeBtn = this.container.querySelector('#jev-btn-mode');
      if (modeBtn) {
        modeBtn.onclick = () => {
          this.mode = this.mode === 'docked' ? 'floating' : 'docked';
          if (this.mode === 'docked') {
            this.container.classList.remove('jev-floating');
            this.container.classList.add('jev-docked');
            this.container.style.left = '';
            this.container.style.top = '';
            this.container.style.right = '0';
            modeBtn.textContent = '⇥';
            modeBtn.title = '当前：贴靠侧栏模式 (点击切换为自由悬浮)';
          } else {
            this.container.classList.remove('jev-docked');
            this.container.classList.add('jev-floating');
            this.container.style.right = '24px';
            this.container.style.top = '80px';
            modeBtn.textContent = '⛶';
            modeBtn.title = '当前：自由悬浮模式 (点击切换为贴靠侧栏)';
          }
        };
      }

      // Minimize
      const minBtn = this.container.querySelector('#jev-btn-min');
      minBtn.onclick = () => {
        this.isMinimized = !this.isMinimized;
        if (this.isMinimized) {
          this.container.classList.add('jev-minimized');
          this.container.querySelector('#jev-toolbar').style.display = 'none';
          this.container.querySelector('#jev-body').style.display = 'none';
          minBtn.textContent = '+';
          minBtn.title = '展开';
        } else {
          this.container.classList.remove('jev-minimized');
          this.container.querySelector('#jev-toolbar').style.display = 'flex';
          this.container.querySelector('#jev-body').style.display = 'block';
          minBtn.textContent = '−';
          minBtn.title = '最小化';
        }
      };

      // Close
      const closeBtn = this.container.querySelector('#jev-btn-close');
      closeBtn.onclick = () => {
        this.container.style.display = 'none';
        const pill = document.getElementById('jev-trigger-pill');
        if (pill) pill.style.display = 'block';
        this.engine.stop();
      };

      // Engine toggle (keeps label clean as 'Jev API' for screen recording)
      const engineToggle = this.container.querySelector('#jev-toggle-engine');
      if (engineToggle) {
        engineToggle.onclick = () => {
          this.engineType = this.engineType === 'mock' ? 'real' : 'mock';
          engineToggle.textContent = 'Jev API';
          engineToggle.style.color = '#34d399';
          engineToggle.style.borderColor = 'rgba(52, 211, 153, 0.4)';
          engineToggle.style.background = 'rgba(52, 211, 153, 0.12)';
          engineToggle.title = this.engineType === 'real' ? 'Jev API · 实时在线连接' : 'Jev API · 极速就绪';
        };
      }

      // Draggable Header
      this.makeDraggable();
    }

    makeDraggable() {
      const header = this.container.querySelector('#jev-header');
      let isDragging = false;
      let startX, startY, initialLeft, initialTop;

      header.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
        if (this.mode === 'docked') {
          this.mode = 'floating';
          this.container.classList.remove('jev-docked');
          this.container.classList.add('jev-floating');
          const mb = this.container.querySelector('#jev-btn-mode');
          if (mb) {
            mb.textContent = '⛶';
            mb.title = '当前：自由悬浮模式 (点击切换为贴靠侧栏)';
          }
        }
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;

        const rect = this.container.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;

        this.container.style.right = 'auto';
        this.container.style.left = `${initialLeft}px`;
        this.container.style.top = `${initialTop}px`;
        header.style.cursor = 'grabbing';
      });

      document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        let newLeft = initialLeft + dx;
        let newTop = initialTop + dy;

        newLeft = Math.max(10, Math.min(window.innerWidth - this.container.offsetWidth - 10, newLeft));
        newTop = Math.max(10, Math.min(window.innerHeight - this.container.offsetHeight - 10, newTop));

        this.container.style.left = `${newLeft}px`;
        this.container.style.top = `${newTop}px`;
      });

      document.addEventListener('mouseup', () => {
        if (isDragging) {
          isDragging = false;
          header.style.cursor = 'grab';
        }
      });
    }
  }

  /* ==========================================================================
     10. Utility & App Entry
     ========================================================================== */
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function initApp() {
    // Only run in top window, ignore Gmail hidden iframes (hangouts, sync, etc.)
    if (window.top !== window.self) return;

    if (!document.body) {
      setTimeout(initApp, 500);
      return;
    }

    if (document.getElementById(CONFIG.CONTAINER_ID)) return;

    const panel = new FloatingPanel();
    panel.init();
    window.jevFloatingPanel = panel;

    // Listen to email row clicks in Gmail inbox table to show its Jev decision in floating window
    GmailDomAdapter.initRowClickListeners((emailId) => {
      panel.showEmailDecision(emailId);
    });

    // Active thread reading companion tracker
    let lastThreadId = null;
    let lastUrl = typeof location !== 'undefined' ? location.href : '';
    setInterval(() => {
      // 1. Re-detect when URL changes or Gmail finishes rendering rows
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        panel.updateDetectedEmails();
      } else if (!panel.engine.isAnalyzing && location.href.includes('mail.google.com')) {
        panel.updateDetectedEmails();
      }

      // Gmail virtualizes its inbox: rows that leave the viewport are destroyed
      // and recreated later. Re-attach cached badges to the recreated rows.
      if (location.href.includes('mail.google.com') && panel.engine.results.length > 0) {
        GmailDomAdapter.restoreDecisionBadges(panel.engine.results);
      }

      // 2. Reading Companion: Detect when user is viewing an email thread in Gmail
      const openedThread = GmailDomAdapter.getOpenedEmailDetails();
      if (openedThread) {
        if (openedThread.id !== lastThreadId) {
          lastThreadId = openedThread.id;
          panel.showEmailDecision(openedThread.id, false, openedThread);
        }
      } else {
        if (lastThreadId) {
          lastThreadId = null;
          // Returned to inbox list: if batch finished, show summary dashboard
          if (!panel.engine.isAnalyzing && panel.engine.results.length >= panel.cachedEmails.length && panel.cachedEmails.length > 0) {
            panel.showSummaryOverview();
          }
        }
      }

      // 3. Ensure container remains mounted if Gmail remounts body
      if (panel.container && !document.getElementById(CONFIG.CONTAINER_ID) && document.body) {
        document.body.appendChild(panel.container);
      }
    }, 1200);

    console.log('[Jev Inbox Decision] Userscript initialized successfully.');
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(initApp, 1000);
  } else {
    window.addEventListener('DOMContentLoaded', () => setTimeout(initApp, 1000));
  }

})();
