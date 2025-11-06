// ==UserScript==
// @name         LeetCode Solution Helper + Auto Submit + Next Problem (v4.5)
// @namespace    http://tampermonkey.net/
// @version      4.5
// @description  Fetch C++ solutions, paste, submit, detect result, wait for page, go to next - WITH START/STOP
// @author       Fixed Version
// @match        https://leetcode.com/problems/*
// @match        https://leetcode.cn/problems/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    let processedBaseUrls = new Set();
    let fetchedSolutionCode = null;
    let clearedEditors = new WeakSet();
    let isAutomationEnabled = localStorage.getItem('__LC_AUTO_ENABLED__') === 'true';

    // ==================== START/STOP CONTROL ====================

    function createControlPanel() {
        const existing = document.getElementById('leetcode-automation-control');
        if (existing) existing.remove();

        const panel = document.createElement('div');
        panel.id = 'leetcode-automation-control';
        
        const isEnabled = isAutomationEnabled;
        const bgColor = isEnabled ? '#4caf50' : '#f5f5f5';
        const borderColor = isEnabled ? '#4caf50' : '#999';
        const btnBgColor = isEnabled ? '#388e3c' : '#999';
        const textColor = isEnabled ? '#000000' : '#666';

        panel.innerHTML = `
            <div style="display: flex; gap: 10px; align-items: center;">
                <div style="font-weight: 600; font-size: 13px; color: ${textColor};">Automation</div>
                <button id="leetcode-automation-toggle" style="
                    padding: 8px 16px;
                    background: ${btnBgColor};
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 12px;
                    transition: all 0.3s;
                ">${isEnabled ? 'STOP' : 'START'}</button>
            </div>
        `;

        panel.style.cssText = `
            position: fixed;
            bottom: 80px;
            right: 20px;
            background: ${bgColor};
            border: 2px solid ${borderColor};
            padding: 12px 16px;
            border-radius: 8px;
            z-index: 10001;
            font-family: system-ui;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;

        document.body.appendChild(panel);

        const toggleBtn = document.getElementById('leetcode-automation-toggle');
        toggleBtn.addEventListener('click', toggleAutomation);
        toggleBtn.addEventListener('mouseover', function() {
            this.style.opacity = '0.8';
        });
        toggleBtn.addEventListener('mouseout', function() {
            this.style.opacity = '1';
        });
    }

    function toggleAutomation() {
        isAutomationEnabled = !isAutomationEnabled;
        localStorage.setItem('__LC_AUTO_ENABLED__', isAutomationEnabled ? 'true' : 'false');
        console.log('[Control] Automation', isAutomationEnabled ? 'ENABLED' : 'DISABLED');
        createControlPanel();
        
        if (isAutomationEnabled) {
            showNotification('Automation Enabled', 'Auto-solving started ✓');
            const slug = getSlugFromUrl();
            if (slug) {
                main();
            }
        } else {
            showNotification('Automation Disabled', 'Auto-solving stopped ⏹');
        }
    }

    // ==================== AUTO SUBMIT AFTER PASTE ====================

    function autoSubmitSolution() {
        if (!isAutomationEnabled) {
            console.log('[Submit] Automation disabled, skipping');
            return;
        }

        console.log('[Submit] Waiting for code to settle...');
        
        setTimeout(() => {
            const script = document.createElement('script');
            script.textContent = `
                (function() {
                    console.log('[PageContext] Looking for submit button...');
                    
                    let submitBtn = null;
                    const allButtons = document.querySelectorAll('button');
                    
                    console.log('[PageContext] Found', allButtons.length, 'total buttons');
                    
                    for (let i = 0; i < allButtons.length; i++) {
                        const btn = allButtons[i];
                        const text = btn.textContent.trim();
                        const ariaLabel = btn.getAttribute('aria-label') || '';
                        
                        if (text.toLowerCase() === 'submit' || 
                            ariaLabel.toLowerCase().includes('submit')) {
                            submitBtn = btn;
                            console.log('[PageContext] Found submit button at index', i);
                            break;
                        }
                    }
                    
                    if (!submitBtn) {
                        console.log('[PageContext] Submit button not found');
                        return;
                    }
                    
                    if (submitBtn.disabled) {
                        console.log('[PageContext] Submit button is disabled');
                        return;
                    }
                    
                    console.log('[PageContext] Clicking submit button...');
                    submitBtn.click();
                    console.log('[PageContext] Submit clicked - waiting 2 seconds before monitoring');
                })();
            `;
            
            document.documentElement.appendChild(script);
            setTimeout(() => script.remove(), 200);
            
            setTimeout(() => {
                if (isAutomationEnabled) {
                    waitForResultAndGoNext();
                }
            }, 2000);
        }, 1000);
    }

    // ==================== WAIT FOR RESULT AND GO TO NEXT ====================

    function waitForResultAndGoNext() {
        if (!isAutomationEnabled) {
            console.log('[NextProblem] Automation disabled, skipping');
            return;
        }

        console.log('[NextProblem] Monitoring for test result...');
        
        let attempts = 0;
        const maxAttempts = 120;
        
        const checkForResult = () => {
            if (!isAutomationEnabled) {
                console.log('[NextProblem] Automation disabled during result check');
                return;
            }

            attempts++;
            
            const script = document.createElement('script');
            script.textContent = `
                (function() {
                    console.log('[PageContext] Checking for result - attempt', \`${attempts}\`);
                    let resultFound = false;
                    
                    const allDivs = document.querySelectorAll('div');
                    
                    for (const div of allDivs) {
                        const text = div.textContent.toLowerCase();
                        const classStr = div.className.toLowerCase();
                        
                        if ((classStr.includes('text-green') || 
                             classStr.includes('green-s')) &&
                            text.includes('accepted')) {
                            console.log('[PageContext] ✓ Found "Accepted" in green div');
                            resultFound = true;
                            break;
                        }
                        
                        if (text.includes('testcases') && 
                            text.includes('passed')) {
                            console.log('[PageContext] ✓ Found testcases passed');
                            resultFound = true;
                            break;
                        }
                        
                        if ((classStr.includes('text-red') || 
                             classStr.includes('red-') ||
                             classStr.includes('orange')) &&
                            (text.includes('wrong') || text.includes('error') || text.includes('runtime'))) {
                            console.log('[PageContext] ✓ Found result (Wrong/Error)');
                            resultFound = true;
                            break;
                        }
                    }
                    
                    if (resultFound) {
                        sessionStorage.setItem('__RESULT_FOUND__', 'true');
                        console.log('[PageContext] Result found, flag set');
                    }
                })();
            `;
            
            document.documentElement.appendChild(script);
            
            setTimeout(() => {
                script.remove();
                
                if (sessionStorage.getItem('__RESULT_FOUND__') === 'true') {
                    console.log('[NextProblem] ✓ Result detected! Waiting 5 seconds for page to fully load...');
                    sessionStorage.removeItem('__RESULT_FOUND__');
                    
                    setTimeout(() => {
                        if (!isAutomationEnabled) {
                            console.log('[NextProblem] Automation disabled, stopping');
                            return;
                        }

                        console.log('[NextProblem] ✓ Page loaded, checking if next button is ready...');
                        
                        const nextBtn = document.querySelector('.h-\\[32px\\]:nth-child(5)');
                        
                        if (nextBtn && !nextBtn.disabled) {
                            console.log('[NextProblem] ✓ Next button is ready, clicking...');
                            nextBtn.click();
                            console.log('[NextProblem] ✓ Clicked next button');
                        } else if (nextBtn && nextBtn.disabled) {
                            console.log('[NextProblem] ⚠ Next button is disabled (end of list)');
                            console.log('[NextProblem] Navigating to problemset');
                            setTimeout(() => {
                                window.location.href = 'https://leetcode.com/problemset/';
                            }, 1000);
                        } else {
                            console.log('[NextProblem] ✗ Next button not found with exact selector, trying fallback...');
                            const nextBtnFallback = document.querySelector('button[aria-label="next"]');
                            if (nextBtnFallback && !nextBtnFallback.disabled) {
                                console.log('[NextProblem] Found fallback next button, clicking...');
                                nextBtnFallback.click();
                            } else {
                                console.log('[NextProblem] No next button found, going to problemset');
                                window.location.href = 'https://leetcode.com/problemset/';
                            }
                        }
                    }, 5000);
                    
                } else if (attempts < maxAttempts) {
                    console.log('[NextProblem] Result not found yet, attempt', attempts + 1, '/', maxAttempts);
                    setTimeout(checkForResult, 500);
                } else {
                    console.log('[NextProblem] Timeout after', maxAttempts, 'attempts (60 seconds)');
                    console.log('[NextProblem] Going to problemset');
                    window.location.href = 'https://leetcode.com/problemset/';
                }
            }, 200);
        };
        
        checkForResult();
    }

    // ==================== PASTE FUNCTIONALITY ====================

    function pasteFetchedCodeToEditor() {
        if (!fetchedSolutionCode) {
            console.log('[Paste] No code to paste');
            return;
        }

        console.log('[Paste] Attempting to paste code...');
        let attempts = 0;
        const maxAttempts = 10;

        const tryPaste = () => {
            attempts++;
            console.log('[Paste] Attempt', attempts, '/', maxAttempts);

            const script = document.createElement('script');
            script.textContent = `
                (function() {
                    console.log('[PageContext] Paste attempt', \`${attempts}\`);
                    
                    if (!window.monaco || !window.monaco.editor) {
                        console.log('[PageContext] Monaco not ready');
                        return;
                    }
                    
                    try {
                        const editors = window.monaco.editor.getEditors();
                        if (!editors || editors.length === 0) {
                            console.log('[PageContext] No editors found');
                            return;
                        }
                        
                        let pasted = false;
                        
                        for (let i = 0; i < editors.length; i++) {
                            const editor = editors[i];
                            if (!editor || !editor.getModel) {
                                console.log('[PageContext] Editor', i, 'invalid');
                                continue;
                            }
                            
                            const model = editor.getModel();
                            if (!model) {
                                console.log('[PageContext] Model null for editor', i);
                                continue;
                            }
                            
                            const value = model.getValue();
                            console.log('[PageContext] Editor', i, '- current length:', value.length);
                            
                            const isEmpty = value.trim() === '';
                            const isTemplate = value.includes('class Solution') || value.includes('def ') || value.includes('function ');
                            
                            if (isEmpty || isTemplate) {
                                try {
                                    const code = \`${fetchedSolutionCode.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;
                                    model.setValue(code);
                                    
                                    if (editor.layout) {
                                        editor.layout();
                                    }
                                    
                                    console.log('[PageContext] ✓ Code pasted to editor', i, '- length:', code.length);
                                    sessionStorage.setItem('__PASTE_DONE__', 'true');
                                    pasted = true;
                                    break;
                                } catch (innerErr) {
                                    console.error('[PageContext] Failed to set code:', innerErr.message);
                                }
                            }
                        }
                        
                        if (!pasted) {
                            console.log('[PageContext] No suitable editor found for pasting');
                        }
                    } catch (e) {
                        console.error('[PageContext] Paste error:', e.message);
                    }
                })();
            `;
            
            document.documentElement.appendChild(script);
            
            setTimeout(() => {
                script.remove();
                
                if (sessionStorage.getItem('__PASTE_DONE__') === 'true') {
                    console.log('[Paste] ✓ Success on attempt', attempts);
                    fetchedSolutionCode = null;
                    sessionStorage.removeItem('__PASTE_DONE__');
                    
                    autoSubmitSolution();
                } else if (attempts < maxAttempts) {
                    console.log('[Paste] Retry attempt', attempts + 1);
                    setTimeout(tryPaste, 800);
                } else {
                    console.log('[Paste] ✗ Failed after', maxAttempts, 'attempts - SKIPPING TO NEXT');
                    showNotification('Paste Failed', 'Skipping to next question...');
                    processedBaseUrls.clear();
                    
                    setTimeout(() => {
                        if (isAutomationEnabled) {
                            const nextBtn = document.querySelector('.h-\\[32px\\]:nth-child(5)');
                            if (nextBtn && !nextBtn.disabled) {
                                console.log('[Paste] Clicking next button to skip');
                                nextBtn.click();
                            } else {
                                console.log('[Paste] Going to problemset');
                                window.location.href = 'https://leetcode.com/problemset/';
                            }
                        }
                    }, 2000);
                }
            }, 500);
        };

        setTimeout(tryPaste, 500);
    }

    // ==================== CLEAR EDITOR ====================

    function clearEditorForNewProblem() {
        const script = document.createElement('script');
        script.textContent = `
            (function() {
                if (window.monaco && window.monaco.editor) {
                    try {
                        const editors = window.monaco.editor.getEditors();
                        editors.forEach((editor, idx) => {
                            const model = editor.getModel();
                            if (model) {
                                const value = model.getValue();
                                if (value && value.length < 500 &&
                                    (value.includes('class Solution') ||
                                     value.includes('function ') ||
                                     value.includes('def ') ||
                                     value.includes('public:'))) {
                                    console.log('[PageContext] Clearing boilerplate in editor', idx);
                                    model.setValue('');
                                }
                            }
                        });
                    } catch (e) {
                        console.error('[PageContext] Clear error:', e.message);
                    }
                }
            })();
        `;
        document.documentElement.appendChild(script);
        setTimeout(() => script.remove(), 200);
    }

    // ==================== SOLUTION HELPER ====================

    function getSlugFromUrl() {
        const pathMatch = window.location.pathname.match(/\/problems\/([^\/]+)/);
        return pathMatch ? pathMatch[1] : null;
    }

    function getBaseProblemUrl() {
        const slug = getSlugFromUrl();
        return slug ? `${window.location.origin}/problems/${slug}` : null;
    }

    function getProblemInfo() {
        const slug = getSlugFromUrl();
        if (!slug) return null;

        const cleanSlug = slug.replace(/^\d+-/, '');

        let titleElement = document.querySelector('h1');
        const title = titleElement ? titleElement.textContent.trim() : slug;

        return { title, slug: cleanSlug };
    }

    async function fetchProblemNumberFromAPI(slug) {
        return new Promise((resolve) => {
            const query = `query {
                question(titleSlug: "${slug}") {
                    questionFrontendId
                }
            }`;

            console.log('[API] Querying for slug:', slug);

            GM_xmlhttpRequest({
                method: 'POST',
                url: 'https://leetcode.com/graphql/',
                headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify({ query }),
                timeout: 5000,
                onload: function(response) {
                    try {
                        const data = JSON.parse(response.responseText);
                        
                        if (data.data?.question?.questionFrontendId) {
                            const num = parseInt(data.data.question.questionFrontendId);
                            console.log('[API] Problem number resolved:', num);
                            resolve(num);
                            return;
                        }
                    } catch (e) {
                        console.log('[API] Parse error:', e.message);
                    }
                    resolve(null);
                },
                onerror: () => {
                    console.log('[API] Request failed');
                    resolve(null);
                }
            });
        });
    }

    function fetchSolution(problemNumber) {
        return new Promise((resolve, reject) => {
            const url = `https://walkccc.me/LeetCode/problems/${problemNumber}`;
            console.log('[Fetch] URL:', url);

            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                timeout: 8000,
                onload: function(response) {
                    if (response.status !== 200) {
                        reject(new Error(`HTTP ${response.status}`));
                        return;
                    }

                    const parser = new DOMParser();
                    const doc = parser.parseFromString(response.responseText, 'text/html');

                    let code = null;
                    const pres = doc.querySelectorAll('pre');

                    for (const pre of pres) {
                        const text = pre.textContent || pre.innerText;
                        if (text.includes('class Solution') ||
                            text.includes('vector<') ||
                            text.includes('#include') ||
                            text.includes('::')) {
                            code = text.trim();
                            console.log('[Fetch] C++ code found');
                            break;
                        }
                    }

                    if (code) {
                        console.log('[Fetch] Code extracted, length:', code.length);
                        resolve(code);
                    } else {
                        if (pres.length > 0) {
                            code = (pres[0].textContent || pres[0].innerText).trim();
                            if (code.length > 10) {
                                resolve(code);
                                return;
                            }
                        }
                        reject(new Error('C++ code not found on page'));
                    }
                },
                onerror: () => reject(new Error('Network error'))
            });
        });
    }

    function showNotification(title, message, isError = false) {
        const existing = document.getElementById('leetcode-helper-notification');
        if (existing) existing.remove();

        const notification = document.createElement('div');
        notification.id = 'leetcode-helper-notification';
        const bgColor = isError ? '#fee' : '#e8f5e9';
        const borderColor = isError ? '#f44336' : '#4caf50';
        const textColor = isError ? '#c62828' : '#000000';
        const icon = isError ? '⚠' : '✓';

        notification.innerHTML = `
            <div style="display: flex; gap: 12px; align-items: center;">
                <div style="font-size: 20px; color: ${borderColor};">${icon}</div>
                <div>
                    <div style="font-weight: 600; font-size: 14px; color: ${textColor};">${title}</div>
                    <div style="font-size: 13px; color: ${textColor};">${message}</div>
                </div>
            </div>
        `;

        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${bgColor};
            border: 2px solid ${borderColor};
            padding: 14px 16px;
            border-radius: 8px;
            z-index: 10000;
            font-family: system-ui;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        `;

        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 5000);
    }

    // ==================== CLEANUP HELPER ====================

    function cleanupMemory() {
        console.log('[Cleanup] Running memory cleanup...');
        
        const keysToCheck = ['__RESULT_FOUND__', '__PASTE_DONE__'];
        keysToCheck.forEach(key => {
            if (sessionStorage.getItem(key)) {
                sessionStorage.removeItem(key);
                console.log('[Cleanup] Cleared sessionStorage:', key);
            }
        });
        
        const scripts = document.querySelectorAll('script');
        let removed = 0;
        scripts.forEach(script => {
            if (script.parentNode && !script.src && script.textContent.includes('[PageContext]')) {
                script.remove();
                removed++;
            }
        });
        if (removed > 0) {
            console.log('[Cleanup] Removed', removed, 'orphaned scripts');
        }
        
        const oldNotifs = document.querySelectorAll('#leetcode-helper-notification');
        if (oldNotifs.length > 1) {
            for (let i = 1; i < oldNotifs.length; i++) {
                oldNotifs[i].remove();
            }
        }
        
        console.log('[Cleanup] Memory cleanup complete');
    }

    setInterval(cleanupMemory, 30000);

    setInterval(() => {
        if (processedBaseUrls.size > 100) {
            console.log('[Cleanup] Clearing processedBaseUrls (size:', processedBaseUrls.size, ')');
            processedBaseUrls.clear();
        }
    }, 60000);

    // ==================== MAIN LOGIC ====================

    async function main() {
        if (!isAutomationEnabled) {
            console.log('[Main] Automation disabled, skipping');
            return;
        }

        const baseUrl = getBaseProblemUrl();
        if (!baseUrl || processedBaseUrls.has(baseUrl)) return;

        processedBaseUrls.add(baseUrl);
        const slug = getSlugFromUrl();

        console.log('[Main] Processing problem:', slug);
        clearEditorForNewProblem();

        let problemInfo = getProblemInfo();
        console.log('[Main] Initial problem info:', problemInfo);

        const apiNumber = await fetchProblemNumberFromAPI(problemInfo.slug);
        
        if (apiNumber) {
            problemInfo.number = apiNumber;
        } else {
            console.log('[Main] API lookup failed');
            showNotification(slug, 'Could not fetch from API', true);
            processedBaseUrls.delete(baseUrl);
            return;
        }

        console.log('[Main] Resolved problem:', problemInfo);

        try {
            showNotification('Fetching', `Problem #${problemInfo.number}...`);
            const solution = await fetchSolution(problemInfo.number);

            fetchedSolutionCode = solution;
            showNotification(
                problemInfo.title || `Problem ${problemInfo.number}`,
                'Solution fetched! Pasting & submitting...'
            );

            console.log('[Main] Solution stored, starting paste...');
            pasteFetchedCodeToEditor();

        } catch (error) {
            console.error('[Main] Error:', error);
            showNotification(
                problemInfo.title || `Problem ${problemInfo.number}`,
                'Error: ' + error.message,
                true
            );
            processedBaseUrls.delete(baseUrl);
        }
    }

    // Initialize
    createControlPanel();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            console.log('[Init] DOM loaded');
            if (isAutomationEnabled) {
                setTimeout(main, 1000);
            }
        });
    } else {
        console.log('[Init] Page ready');
        if (isAutomationEnabled) {
            setTimeout(main, 1000);
        }
    }

    // Monitor URL changes
    let lastBaseUrl = getBaseProblemUrl();
    window.addEventListener('popstate', () => {
        const currentBaseUrl = getBaseProblemUrl();
        if (currentBaseUrl && currentBaseUrl !== lastBaseUrl && isAutomationEnabled) {
            lastBaseUrl = currentBaseUrl;
            clearedEditors = new WeakSet();
            console.log('[Nav] URL changed');
            setTimeout(main, 1000);
        }
    });

    const originalPushState = window.history.pushState;
    window.history.pushState = function(...args) {
        originalPushState.apply(window.history, args);
        const currentBaseUrl = getBaseProblemUrl();
        if (currentBaseUrl && currentBaseUrl !== lastBaseUrl && isAutomationEnabled) {
            lastBaseUrl = currentBaseUrl;
            clearedEditors = new WeakSet();
            console.log('[Nav] pushState detected');
            setTimeout(main, 1000);
        }
    };
})();
