<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# LeetCode Automation Userscript

## Overview

LeetCode Automation Userscript is a Tampermonkey/Greasemonkey userscript that automates the workflow of solving LeetCode problems. The script fetches pre-written C++ solutions from walkccc.me, injects them into the editor, submits the code, detects results, and automatically navigates to the next problem in a submission queue.

## Features

- **Automated Solution Fetching**: Retrieves C++ solutions from walkccc.me using problem number resolution via LeetCode GraphQL API
- **Code Injection**: Injects solutions into Monaco Editor instances with automatic editor detection
- **Automatic Submission**: Locates and clicks the submit button with configurable delays
- **Result Detection**: Monitors the DOM for acceptance/failure states with configurable polling intervals
- **Sequential Navigation**: Automatically clicks the next button to navigate through submission queues
- **Start/Stop Control**: Toggle automation on/off with persistent state storage via localStorage
- **Retry Mechanism**: Implements exponential backoff for paste failures (up to 10 attempts)
- **Auto-Skip**: Skips to next problem after paste failure threshold is reached
- **Memory Management**: Implements periodic garbage collection to prevent memory leaks and browser degradation
- **Error Handling**: Comprehensive logging and user notifications for debugging


## Installation

1. Install a userscript manager:
    - Chrome/Edge: [Tampermonkey](https://www.tampermonkey.net/) or Violentmonkey
    - Firefox: Greasemonkey or Tampermonkey
    - Safari: Tampermonkey
2. Create a new userscript with the following header:

```javascript
// ==UserScript==
// @name         LeetCode Solution Helper
// @namespace    http://tampermonkey.net/
// @version      4.5
// @match        https://leetcode.com/problems/*
// @match        https://leetcode.cn/problems/*
// @grant        GM_xmlhttpRequest
// @run-at       document-idle
// ==/UserScript==
```

3. Copy the entire script into the userscript editor
4. Save and navigate to any LeetCode problem page

## Usage

### Basic Operation

1. Navigate to any LeetCode problem page
2. Locate the green control panel at the bottom-right of the viewport
3. Click the START button to enable automation
4. The script will automatically:
    - Fetch the solution for the current problem
    - Inject code into the editor
    - Submit the solution
    - Wait for result confirmation
    - Click next button to proceed to the next problem

### Control Panel

The control panel displays automation state:

- Green background with black "Automation" text: Automation enabled
- White background with gray text: Automation disabled


### Disabling Automation

Click the STOP button to halt all automation operations. Current execution will complete, but no new operations will be initiated.

## Configuration

### Timing Parameters

Edit these values in the source code to adjust behavior:

- `pasteFetchedCodeToEditor()`: Retry delay = 800ms, Max attempts = 10
- `autoSubmitSolution()`: Initial delay = 1000ms, Post-submit delay = 2000ms
- `waitForResultAndGoNext()`: Poll interval = 500ms, Result detection delay = 5000ms, Max poll attempts = 120
- Memory cleanup: Every 30 seconds
- ProcessedBaseUrls clear threshold: 100 items


### Result Detection Patterns

The script searches for these DOM indicators:

- Accepted state: Text "accepted" with class containing "text-green" or "green-s"
- Testcase pass: Text containing "testcases passed"
- Failure state: Text containing "wrong", "error", or "runtime" with class containing "text-red", "red-", or "orange"


## Architecture

### Component Structure

1. **Control Panel Manager** (`createControlPanel`, `toggleAutomation`)
    - Creates persistent UI element for start/stop control
    - Stores state in localStorage
2. **Code Injection Pipeline**
    - `pasteFetchedCodeToEditor()`: Attempts code injection with retry logic
    - `autoSubmitSolution()`: Locates and triggers submit button
    - `clearEditorForNewProblem()`: Removes boilerplate code before injection
3. **Result Monitoring** (`waitForResultAndGoNext`)
    - Polls DOM for result indicators
    - Implements timeout mechanism
    - Auto-clicks next button with delay
4. **API Integration**
    - `fetchProblemNumberFromAPI()`: GraphQL query to resolve problem slugs to numbers
    - `fetchSolution()`: HTTP GET request to walkccc.me
5. **Memory Management**
    - Periodic cleanup of sessionStorage entries
    - Orphaned script removal
    - Notification DOM node deduplication
    - ProcessedBaseUrls set pruning

### Execution Flow

```
main() 
  → clearEditorForNewProblem()
  → fetchProblemNumberFromAPI()
  → fetchSolution()
  → pasteFetchedCodeToEditor()
    → (retry loop)
    → autoSubmitSolution()
    → waitForResultAndGoNext()
      → (polling loop)
      → click next button
      → (URL change detected)
      → main() [recursive]
```


## Troubleshooting

### Paste Verification Failed

**Cause**: Monaco editor instances not accessible or model extraction failed

**Solution**:

- Clear sessionStorage: `sessionStorage.clear()` in browser console
- Reload page
- Verify Monaco editor is fully loaded before code injection


### Script Stuck on Result Detection

**Cause**: Result indicator not matching DOM patterns

**Solution**:

- Check console logs for actual result text
- Verify CSS classes match detection patterns
- Adjust polling timeout in `waitForResultAndGoNext()`


### Browser Performance Degradation

**Cause**: Memory accumulation from DOM elements, scripts, or processedBaseUrls set

**Solution**:

- Manual cleanup: `sessionStorage.clear()` in console
- Restart browser to clear all sessionStorage
- Force garbage collection (Chrome only): Run with `--js-flags="--expose-gc"` and call `gc()` in console


### Next Button Not Found

**Cause**: Button selector changed or network navigation failed

**Solution**:

- Primary selector: `.h-$32px$:nth-child(5)`
- Fallback selector: `button[aria-label="next"]`
- If neither matches, inspect element and update selector


## Performance Considerations

### Memory Usage

The script implements three-tier memory management:

1. Real-time cleanup: Removes scripts after execution completes
2. Periodic cleanup: Every 30 seconds, clears old sessionStorage and notification nodes
3. Threshold cleanup: When processedBaseUrls exceeds 100 items, clears the set

Typical memory overhead: 5-15MB after 50+ problems

### Network Overhead

- GraphQL queries to LeetCode: ~5KB per problem
- HTTP requests to walkccc.me: ~50-200KB per solution

Recommendation: Use on metered connections with caution

### DOM Polling Performance

Result detection uses naive DOM traversal (O(n) where n = total div elements). On pages with 1000+ divs, polling may consume 1-2% CPU. Consider increasing poll interval for slower systems.

## Error Handling

### Logging

All operations log to browser console with prefixes:

- `[Init]`: Initialization
- `[Main]`: Main execution flow
- `[API]`: GraphQL queries
- `[Fetch]`: Solution fetching
- `[Paste]`: Code injection
- `[Submit]`: Submission
- `[NextProblem]`: Navigation
- `[Cleanup]`: Memory management


### User Notifications

Toast notifications appear at top-right corner:

- Green background: Success operations
- Red background: Error conditions
- Auto-dismiss after 5 seconds


## API References

### LeetCode GraphQL Endpoint

```
POST https://leetcode.com/graphql/
Query: { question(titleSlug: "slug") { questionFrontendId } }
```

Returns problem number for given problem slug.

### Solution Source

walkccc.me provides C++ solutions indexed by problem number. Script extracts from `<pre>` tags containing "class Solution" or C++ indicators.

## Limitations

1. Supports C++ only (walkccc.me limitation)
2. Requires JavaScript execution in userscript context
3. Monaco editor instance detection limited to LeetCode's current implementation
4. GraphQL API query rate limited (respects timeout)
5. No support for custom solution sources

## Dependencies

- Tampermonkey/Greasemonkey for userscript execution
- LeetCode's Monaco editor API access
- External HTTP access to walkccc.me
- localStorage API for state persistence


## Security Considerations

- Script executes code fetched from external source (walkccc.me)
- Injects code into editor without validation
- Recommend using on personal accounts only
- GraphQL queries are anonymous, no credentials stored


## License

MIT License. See LICENSE file for details.

## Contributing

Report issues via GitHub issues tracker. Include:

- Browser and userscript manager version
- Exact LeetCode problem URL
- Console output (F12 → Console)
- Steps to reproduce


## Version History

- v4.5: Added auto-skip on paste failure, 2-second submit delay, memory cleanup
- v4.4: Implemented memory management and garbage collection
- v4.3: Added retry logic and slower navigation
- v4.2: START/STOP control panel
- v4.1: Persistence across page reloads
- v4.0: Initial release with basic automation

