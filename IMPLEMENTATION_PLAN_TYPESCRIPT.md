# Implementation Plan: TypeScript Support for JSPad

## Executive Summary

This plan details how to add full TypeScript support to JSPad, including:
1. **Type-aware autocomplete** - Show string methods when typing `k.` where `k: string`
2. **Type hints on hover** - Display `const k: string` when hovering over variable `k`
3. **Syntax support** - Allow TypeScript syntax like `const k: string = 'abc'` without errors
4. **Type checking** - Show TypeScript errors in the editor

## Current State Analysis

### Existing Architecture
- **Editor**: CodeMirror 6 with `@codemirror/lang-javascript` (JavaScript only)
- **Execution**: Web Worker using `new Function()` to execute raw JavaScript
- **No TypeScript Support**: No language service, no type checking, no IntelliSense

### Key Files
- `src/components/EditorPanel.tsx` - CodeMirror initialization (lines 40-81)
- `src/workers/code-executor.worker.ts` - Code execution environment
- `package.json` - Dependencies (TypeScript is peer dependency only)

### Problem Statement
When user types `const k: string = 'abc'`, the editor shows:
```
Unexpected token ')'. Expected a property name after '.'
```

This is because `@codemirror/lang-javascript` doesn't understand TypeScript syntax.

## Solution Architecture

### Selected Approach: @valtown/codemirror-ts

**Why this solution:**
- ✅ Specifically designed for CodeMirror 6 + TypeScript
- ✅ Provides `tsAutocomplete()` and `tsHover()` extensions
- ✅ Runs TypeScript compiler in Web Worker (non-blocking)
- ✅ Supports virtual file system for type definitions
- ✅ Automatic Type Acquisition (ATA) for NPM types
- ✅ Battle-tested by Val Town

**Alternative approaches rejected:**
- ❌ Monaco Editor - Would require complete editor rewrite
- ❌ LSP over WebSocket - Overkill for browser-only app
- ❌ `@codemirror/lang-typescript` - Syntax only, no language service

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Main Thread                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  EditorPanel.tsx                                       │  │
│  │  - CodeMirror 6 with tsAutocomplete() & tsHover()     │  │
│  │  - Communicates with TS Worker via Comlink            │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │ Comlink
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   TypeScript Worker                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  ts-language.worker.ts (NEW)                          │  │
│  │  - Virtual TypeScript Environment (@typescript/vfs)   │  │
│  │  - Language Service API                               │  │
│  │  - Type Definitions (CDN + ATA)                       │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                Code Execution Worker (EXISTING)              │
│  - Executes transpiled JavaScript                           │
│  - Console capture, DOM polyfills                           │
└─────────────────────────────────────────────────────────────┘
```

**Key Design Decisions:**
1. **Separate Workers**: TypeScript language service runs in dedicated worker, code execution in existing worker
2. **TypeScript → JavaScript**: Transpile TypeScript to JavaScript before sending to execution worker
3. **Virtual FS**: Load type definitions from CDN (unpkg/jsdelivr) into memory
4. **Shared Environment**: Single TypeScript environment handles all editor instances

## Implementation Tasks

### Phase 1: Dependencies & Setup

#### Task 1.1: Install Required Dependencies

**File:** `package.json`

**Action:** Add new dependencies to `dependencies` section:

```json
{
  "dependencies": {
    "@valtown/codemirror-ts": "^1.4.0",
    "comlink": "^4.4.1",
    "typescript": "^5.6.0"
  },
  "devDependencies": {
    "@typescript/vfs": "^1.6.0",
    "@typescript/ata": "^0.9.7"
  }
}
```

**Note:** Move `typescript` from `peerDependencies` to `dependencies`.

**Command to run:**
```bash
bun install @valtown/codemirror-ts comlink
bun install -D @typescript/vfs @typescript/ata
```

**Verification:**
- Check `package.json` has new dependencies
- Run `bun install` successfully
- Verify `node_modules/@valtown/codemirror-ts` exists

---

### Phase 2: TypeScript Worker Implementation

#### Task 2.1: Create TypeScript Language Worker

**File:** `src/workers/ts-language.worker.ts` (NEW FILE)

**Complete Implementation:**

```typescript
// src/workers/ts-language.worker.ts
import * as Comlink from 'comlink';
import ts from 'typescript';
import {
  createDefaultMapFromCDN,
  createSystem,
  createVirtualTypeScriptEnvironment,
} from '@typescript/vfs';

export interface WorkerShape {
  getCompletions(fileName: string, position: number): Promise<ts.CompletionInfo | undefined>;
  getQuickInfo(fileName: string, position: number): Promise<ts.QuickInfo | undefined>;
  updateFile(fileName: string, content: string): void;
  transpile(code: string): string;
}

// TypeScript compiler options
const compilerOptions: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2020,
  module: ts.ModuleKind.ESNext,
  lib: ['lib.es2020.d.ts', 'lib.dom.d.ts'],
  strict: true,
  esModuleInterop: true,
  skipLibCheck: true,
  allowSyntheticDefaultImports: true,
  jsx: ts.JsxEmit.React,
  moduleResolution: ts.ModuleResolutionKind.NodeJs,
};

let env: ReturnType<typeof createVirtualTypeScriptEnvironment> | null = null;
let languageService: ts.LanguageService | null = null;
const currentFiles = new Map<string, string>();

// Initialize TypeScript environment
async function initialize() {
  console.log('[TS Worker] Initializing TypeScript environment...');

  try {
    // Create virtual file system with lib.d.ts files from CDN
    const fsMap = await createDefaultMapFromCDN(
      compilerOptions,
      ts.version,
      true,
      ts,
      // Use unpkg.com as CDN source
      undefined
    );

    console.log('[TS Worker] Loaded', fsMap.size, 'lib files from CDN');

    // Create virtual system
    const system = createSystem(fsMap);

    // Create TypeScript environment
    env = createVirtualTypeScriptEnvironment(
      system,
      [],
      ts,
      compilerOptions
    );

    languageService = env.languageService;
    console.log('[TS Worker] TypeScript environment ready');
  } catch (error) {
    console.error('[TS Worker] Failed to initialize:', error);
    throw error;
  }
}

// Initialize on worker load
initialize();

// Worker API implementation
const worker: WorkerShape = {
  async getCompletions(fileName: string, position: number) {
    if (!languageService) {
      console.warn('[TS Worker] Language service not ready');
      return undefined;
    }

    try {
      const completions = languageService.getCompletionsAtPosition(
        fileName,
        position,
        undefined
      );
      return completions;
    } catch (error) {
      console.error('[TS Worker] getCompletions error:', error);
      return undefined;
    }
  },

  async getQuickInfo(fileName: string, position: number) {
    if (!languageService) {
      console.warn('[TS Worker] Language service not ready');
      return undefined;
    }

    try {
      const quickInfo = languageService.getQuickInfoAtPosition(
        fileName,
        position
      );
      return quickInfo;
    } catch (error) {
      console.error('[TS Worker] getQuickInfo error:', error);
      return undefined;
    }
  },

  updateFile(fileName: string, content: string) {
    if (!env) {
      console.warn('[TS Worker] Environment not ready');
      return;
    }

    try {
      currentFiles.set(fileName, content);
      env.createFile(fileName, content);
      console.log('[TS Worker] Updated file:', fileName, content.length, 'chars');
    } catch (error) {
      console.error('[TS Worker] updateFile error:', error);
    }
  },

  transpile(code: string) {
    try {
      const result = ts.transpileModule(code, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2020,
          module: ts.ModuleKind.ESNext,
          jsx: ts.JsxEmit.React,
        },
      });
      return result.outputText;
    } catch (error) {
      console.error('[TS Worker] Transpile error:', error);
      throw error;
    }
  },
};

// Expose worker API via Comlink
Comlink.expose(worker);

export {};
```

**Why this implementation:**
- Uses `@typescript/vfs` to load TypeScript lib files from CDN
- Exposes 4 methods: completions, hover info, file updates, transpilation
- Initializes asynchronously on worker load
- Handles errors gracefully with logging

**Verification:**
- Worker file compiles without errors
- Worker exposes correct interface via Comlink

---

#### Task 2.2: Configure Vite for Worker Support

**File:** `vite.config.ts`

**Current content:**
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  worker: {
    format: 'es',
  },
});
```

**Action:** Add worker configuration to support TypeScript workers:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  worker: {
    format: 'es',
    plugins: () => [react()],
  },
  optimizeDeps: {
    exclude: ['@valtown/codemirror-ts'],
  },
});
```

**Changes:**
- `worker.plugins` - Apply React plugin to workers
- `optimizeDeps.exclude` - Prevent Vite from pre-bundling codemirror-ts

**Verification:**
- Vite dev server starts without warnings
- Workers build correctly

---

### Phase 3: Editor Integration

#### Task 3.1: Create TypeScript Worker Manager Hook

**File:** `src/hooks/useTypeScriptWorker.ts` (NEW FILE)

**Complete Implementation:**

```typescript
// src/hooks/useTypeScriptWorker.ts
import { useEffect, useRef } from 'react';
import * as Comlink from 'comlink';
import type { WorkerShape } from '../workers/ts-language.worker';

export function useTypeScriptWorker() {
  const workerRef = useRef<Worker | null>(null);
  const apiRef = useRef<Comlink.Remote<WorkerShape> | null>(null);

  useEffect(() => {
    console.log('[Main] Initializing TypeScript worker...');

    // Create worker
    const worker = new Worker(
      new URL('../workers/ts-language.worker.ts', import.meta.url),
      { type: 'module' }
    );

    workerRef.current = worker;

    // Wrap worker with Comlink
    const api = Comlink.wrap<WorkerShape>(worker);
    apiRef.current = api;

    console.log('[Main] TypeScript worker ready');

    // Cleanup
    return () => {
      console.log('[Main] Terminating TypeScript worker...');
      worker.terminate();
      apiRef.current = null;
      workerRef.current = null;
    };
  }, []);

  return apiRef.current;
}
```

**Why this hook:**
- Manages worker lifecycle (creation, cleanup)
- Provides Comlink-wrapped API to components
- Ensures single worker instance per app lifecycle

**Verification:**
- Hook creates worker on mount
- Hook terminates worker on unmount
- Console shows "[Main] TypeScript worker ready"

---

#### Task 3.2: Update EditorPanel with TypeScript Support

**File:** `src/components/EditorPanel.tsx`

**Current imports (lines 1-6):**
```typescript
import { useEffect, useRef } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { EditorState } from '@codemirror/state';
import { autocompletion } from '@codemirror/autocomplete';
```

**Replace with:**
```typescript
import { useEffect, useRef } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { EditorState } from '@codemirror/state';
import { autocompletion } from '@codemirror/autocomplete';
import { tsAutocomplete, tsHover, tsSync } from '@valtown/codemirror-ts';
import type { WorkerShape } from '../workers/ts-language.worker';
import * as Comlink from 'comlink';
```

**Update EditorPanelProps interface (lines 8-12):**
```typescript
interface EditorPanelProps {
  code: string;
  onChange: (code: string) => void;
  onScroll?: (scrollTop: number) => void;
  tsWorker?: Comlink.Remote<WorkerShape> | null; // NEW
}
```

**Update component signature (line 14):**
```typescript
export function EditorPanel({ code, onChange, onScroll, tsWorker }: EditorPanelProps) {
```

**Update useEffect for editor initialization (lines 40-81):**

Replace entire `useEffect(() => { ... }, [])` block with:

```typescript
useEffect(() => {
  if (!editorRef.current) return;

  const fileName = '/main.tsx'; // Virtual file name

  const startState = EditorState.create({
    doc: code,
    extensions: [
      basicSetup,
      javascript({ typescript: true }), // Enable TypeScript syntax
      vscodeDark,
      autocompletion({
        activateOnTyping: true,
        override: tsWorker ? [tsAutocomplete()] : [], // TypeScript autocomplete
      }),
      tsWorker ? tsHover() : [], // TypeScript hover tooltips
      tsWorker ? tsSync(fileName) : [], // Sync file changes to worker
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const newCode = update.state.doc.toString();
          onChangeRef.current(newCode);

          // Update TypeScript worker with new content
          if (tsWorker) {
            tsWorker.updateFile(fileName, newCode);
          }
        }
      }),
      EditorView.domEventHandlers({
        scroll: (_event, view) => {
          if (onScrollRef.current) {
            onScrollRef.current(view.scrollDOM.scrollTop);
          }
        },
      }),
    ],
  });

  const view = new EditorView({
    state: startState,
    parent: editorRef.current,
  });

  viewRef.current = view;

  // Auto-focus when editor is mounted
  view.focus();

  // Initialize file in TypeScript worker
  if (tsWorker) {
    tsWorker.updateFile(fileName, code);
  }

  return () => {
    view.destroy();
  };
}, [tsWorker]); // Add tsWorker to dependency array
```

**Key changes:**
1. `javascript({ typescript: true })` - Enable TypeScript syntax parsing
2. `tsAutocomplete()` - Add TypeScript autocomplete
3. `tsHover()` - Add hover tooltips
4. `tsSync(fileName)` - Sync editor state with worker
5. Update worker on document changes
6. Initialize worker with initial code
7. Add `tsWorker` to dependency array

**IMPORTANT NOTES:**
- The `fileName` is a virtual path (`/main.tsx`) that TypeScript worker uses internally
- Worker is updated on every document change for real-time type checking
- TypeScript extensions are conditional on `tsWorker` being available (graceful degradation)

**Verification:**
- Editor component compiles without errors
- No TypeScript type errors in EditorPanel.tsx

---

### Phase 4: App Integration

#### Task 4.1: Update App.tsx to Provide TypeScript Worker

**File:** `src/App.tsx`

**Find where EditorPanel is rendered.** Current structure likely looks like:

```typescript
<EditorPanel
  code={currentTab.code}
  onChange={handleCodeChange}
  onScroll={handleEditorScroll}
/>
```

**Required changes:**

1. **Add import at top of file:**
```typescript
import { useTypeScriptWorker } from './hooks/useTypeScriptWorker';
```

2. **Initialize worker hook in component:**
Add this line at the top of the App component function:
```typescript
const tsWorker = useTypeScriptWorker();
```

3. **Pass worker to EditorPanel:**
```typescript
<EditorPanel
  code={currentTab.code}
  onChange={handleCodeChange}
  onScroll={handleEditorScroll}
  tsWorker={tsWorker}
/>
```

**Complete context-aware instructions:**

First, read the current App.tsx to locate:
- Where `EditorPanel` is imported
- Where `EditorPanel` is rendered
- The component structure

Then apply these changes:
1. Add `useTypeScriptWorker` import after other hook imports
2. Call `useTypeScriptWorker()` hook near other hook calls
3. Add `tsWorker={tsWorker}` prop to `<EditorPanel />` component

**Verification:**
- App.tsx compiles without errors
- TypeScript worker initializes on app load
- Browser console shows "[Main] TypeScript worker ready"

---

### Phase 5: Code Execution Integration

#### Task 5.1: Add TypeScript Transpilation to Code Execution

**File:** `src/hooks/useCodeExecution.ts`

**Current flow:**
```
User Code → Execute directly in worker
```

**New flow:**
```
User Code (TypeScript) → Transpile to JavaScript → Execute in worker
```

**Required changes:**

1. **Add imports at top of file:**
```typescript
import type { WorkerShape } from '../workers/ts-language.worker';
import * as Comlink from 'comlink';
```

2. **Update hook signature to accept tsWorker:**

Find the hook definition (should look like `export function useCodeExecution(...)`), and add `tsWorker` parameter:

```typescript
export function useCodeExecution(
  code: string,
  autoExecute: boolean,
  autoExecuteDelay: number,
  timeout: number,
  tsWorker: Comlink.Remote<WorkerShape> | null
) {
```

3. **Update execute function to transpile TypeScript:**

Find the `execute` function inside the hook. Before sending code to worker, add transpilation:

```typescript
const execute = async () => {
  if (!workerRef.current) return;

  let jsCode = code;

  // Transpile TypeScript to JavaScript if worker is available
  if (tsWorker) {
    try {
      console.log('[Execution] Transpiling TypeScript...');
      jsCode = await tsWorker.transpile(code);
      console.log('[Execution] Transpiled successfully');
    } catch (error) {
      console.error('[Execution] Transpilation error:', error);
      setOutput([{
        type: 'error',
        content: `TypeScript Error: ${error}`,
      }]);
      setIsExecuting(false);
      return;
    }
  }

  setIsExecuting(true);
  setOutput([]);

  workerRef.current.postMessage({
    type: 'execute',
    code: jsCode, // Use transpiled code
    timeout,
  });
};
```

**IMPORTANT:** Make sure to:
- Replace `code` with `jsCode` when posting message to worker
- Handle transpilation errors gracefully
- Show transpilation errors in output panel

**Verification:**
- Hook compiles without TypeScript errors
- TypeScript code transpiles before execution

---

#### Task 5.2: Update App.tsx Code Execution Hook Call

**File:** `src/App.tsx`

**Find where useCodeExecution is called.** Should look similar to:

```typescript
const { output, isExecuting, execute } = useCodeExecution(
  currentTab.code,
  settings.autoExecute,
  settings.autoExecuteDelay,
  settings.executionTimeout
);
```

**Update to pass tsWorker:**

```typescript
const { output, isExecuting, execute } = useCodeExecution(
  currentTab.code,
  settings.autoExecute,
  settings.autoExecuteDelay,
  settings.executionTimeout,
  tsWorker // Add this parameter
);
```

**Verification:**
- App.tsx compiles successfully
- No TypeScript errors about missing parameters

---

### Phase 6: Testing & Verification

#### Task 6.1: Manual Testing Checklist

**Test Case 1: TypeScript Syntax Support**

1. Clear editor
2. Type: `const k: string = 'abc'`
3. **Expected:** No syntax errors, code highlights correctly
4. **Success Criteria:** No "Unexpected token" errors

**Test Case 2: Autocomplete**

1. Type: `const k: string = 'abc'`
2. On new line, type: `k.`
3. **Expected:** Autocomplete menu appears with string methods (`.toLowerCase()`, `.toUpperCase()`, `.length`, etc.)
4. **Success Criteria:** At least 10+ string methods shown

**Test Case 3: Hover Tooltips**

1. Type: `const k: string = 'abc'`
2. Hover mouse over `k`
3. **Expected:** Tooltip appears showing `const k: string`
4. **Success Criteria:** Type information displayed correctly

**Test Case 4: Code Execution**

1. Type:
   ```typescript
   const greeting: string = 'Hello, TypeScript!';
   console.log(greeting);
   ```
2. Press "Run" or wait for auto-execute
3. **Expected:** Console shows `Hello, TypeScript!`
4. **Success Criteria:** TypeScript transpiles and executes correctly

**Test Case 5: Type Errors**

1. Type:
   ```typescript
   const num: number = 'text'; // Type error
   console.log(num);
   ```
2. **Expected:** Code still executes (TypeScript is permissive)
3. **Note:** Language service shows error in editor, but execution continues
4. **Success Criteria:** Code runs despite type error

**Test Case 6: Advanced TypeScript Features**

1. Type:
   ```typescript
   interface User {
     name: string;
     age: number;
   }

   const user: User = { name: 'Alice', age: 30 };
   console.log(user.name);
   ```
2. Type: `user.` on new line
3. **Expected:** Autocomplete shows `name` and `age` properties
4. **Success Criteria:** Interface types work correctly

---

#### Task 6.2: Performance Testing

**Test:** Worker initialization time
- Open browser DevTools console
- Reload page
- Measure time between "[Main] Initializing TypeScript worker..." and "[Main] TypeScript worker ready"
- **Expected:** < 2 seconds

**Test:** Autocomplete response time
- Type `k.` where `k` is a string
- Measure time until autocomplete menu appears
- **Expected:** < 300ms

**Test:** Transpilation time
- Write 100 lines of TypeScript
- Execute code
- Check console for "[Execution] Transpiled successfully"
- **Expected:** < 500ms

---

### Phase 7: Error Handling & Edge Cases

#### Task 7.1: Handle Worker Initialization Failure

**File:** `src/hooks/useTypeScriptWorker.ts`

**Add error handling:**

```typescript
export function useTypeScriptWorker() {
  const workerRef = useRef<Worker | null>(null);
  const apiRef = useRef<Comlink.Remote<WorkerShape> | null>(null);

  useEffect(() => {
    console.log('[Main] Initializing TypeScript worker...');

    try {
      const worker = new Worker(
        new URL('../workers/ts-language.worker.ts', import.meta.url),
        { type: 'module' }
      );

      workerRef.current = worker;

      // Handle worker errors
      worker.onerror = (error) => {
        console.error('[Main] TypeScript worker error:', error);
      };

      const api = Comlink.wrap<WorkerShape>(worker);
      apiRef.current = api;

      console.log('[Main] TypeScript worker ready');
    } catch (error) {
      console.error('[Main] Failed to initialize TypeScript worker:', error);
      // Worker is null, app continues without TypeScript features
    }

    return () => {
      if (workerRef.current) {
        console.log('[Main] Terminating TypeScript worker...');
        workerRef.current.terminate();
      }
      apiRef.current = null;
      workerRef.current = null;
    };
  }, []);

  return apiRef.current;
}
```

**Why:** Graceful degradation - if worker fails, app still works with basic JavaScript support.

---

#### Task 7.2: Handle Transpilation Errors

**Already implemented in Task 5.1** - transpilation errors are caught and displayed in output panel.

**Additional improvement in `src/hooks/useCodeExecution.ts`:**

```typescript
if (tsWorker) {
  try {
    console.log('[Execution] Transpiling TypeScript...');
    jsCode = await tsWorker.transpile(code);
    console.log('[Execution] Transpiled successfully');
  } catch (error) {
    console.error('[Execution] Transpilation error:', error);

    // Extract TypeScript error message
    const errorMessage = error instanceof Error
      ? error.message
      : String(error);

    setOutput([{
      type: 'error',
      content: `TypeScript Compilation Error:\n${errorMessage}`,
    }]);
    setIsExecuting(false);
    return;
  }
}
```

---

### Phase 8: Documentation & Cleanup

#### Task 8.1: Update README.md

**File:** `README.md`

**Add section after "Features":**

```markdown
## TypeScript Support

JSPad now includes full TypeScript support with:

- **Type-aware autocomplete**: IntelliSense for variables, methods, and properties
- **Hover tooltips**: View type information by hovering over code
- **TypeScript syntax**: Write TypeScript directly in the editor
- **Automatic transpilation**: TypeScript code is automatically transpiled to JavaScript before execution

### Example

```typescript
interface Person {
  name: string;
  age: number;
}

const person: Person = { name: 'Alice', age: 30 };
console.log(person.name); // Autocomplete works for 'name' and 'age'
```

### Technical Details

- Uses `@valtown/codemirror-ts` for language service integration
- TypeScript compiler runs in a Web Worker for non-blocking operation
- Type definitions loaded from CDN on startup
```

---

#### Task 8.2: Add TypeScript Configuration File

**File:** `tsconfig.json` (UPDATE EXISTING)

**Current TypeScript config is for app build only. Update to document runtime behavior:**

Add comment block at top:

```json
{
  // NOTE: This tsconfig.json is for the JSPad application itself.
  // TypeScript code written IN the editor uses separate compiler options
  // defined in src/workers/ts-language.worker.ts

  "compilerOptions": {
    // ... existing config
  }
}
```

---

#### Task 8.3: Create Type Definition Files

**File:** `src/types/codemirror-ts.d.ts` (NEW FILE)

**Add type definitions for @valtown/codemirror-ts if not provided by package:**

```typescript
// src/types/codemirror-ts.d.ts
declare module '@valtown/codemirror-ts' {
  import { Extension } from '@codemirror/state';
  import type * as Comlink from 'comlink';

  export function tsAutocomplete(
    worker?: Comlink.Remote<any>
  ): (context: any) => Promise<any>;

  export function tsHover(
    worker?: Comlink.Remote<any>
  ): Extension;

  export function tsSync(
    fileName: string
  ): Extension;
}
```

**Verification:**
- No TypeScript errors in editor imports
- TypeScript recognizes @valtown/codemirror-ts exports

---

## Implementation Order

Execute tasks in this strict order to avoid dependency issues:

1. ✅ **Phase 1 (Dependencies)** - Task 1.1
2. ✅ **Phase 2 (Worker)** - Tasks 2.1 → 2.2
3. ✅ **Phase 3 (Editor)** - Tasks 3.1 → 3.2
4. ✅ **Phase 4 (App)** - Task 4.1
5. ✅ **Phase 5 (Execution)** - Tasks 5.1 → 5.2
6. ✅ **Phase 6 (Testing)** - Tasks 6.1 → 6.2
7. ✅ **Phase 7 (Error Handling)** - Tasks 7.1 → 7.2
8. ✅ **Phase 8 (Documentation)** - Tasks 8.1 → 8.3

**Critical Path:**
- Cannot start Phase 3 until Phase 2 is complete (worker must exist)
- Cannot test Phase 6 until Phase 5 is complete (execution must work)

## Success Criteria

### Must Have (Blocking)
- ✅ TypeScript syntax `const k: string = 'abc'` shows no errors
- ✅ Typing `k.` shows string methods in autocomplete
- ✅ Hovering over `k` shows type `const k: string`
- ✅ TypeScript code executes correctly (transpiles to JavaScript)
- ✅ No console errors on page load
- ✅ No TypeScript compilation errors in codebase

### Should Have (Important)
- ✅ Autocomplete appears in < 300ms
- ✅ Worker initializes in < 2 seconds
- ✅ Transpilation completes in < 500ms
- ✅ Error messages are user-friendly

### Nice to Have (Optional)
- ⬜ Automatic Type Acquisition (ATA) for NPM packages
- ⬜ Multi-file TypeScript projects
- ⬜ Import statement resolution
- ⬜ Type error diagnostics inline

## Rollback Plan

If implementation fails, rollback steps:

1. Remove TypeScript worker: Delete `src/workers/ts-language.worker.ts`
2. Remove hook: Delete `src/hooks/useTypeScriptWorker.ts`
3. Revert EditorPanel.tsx to git version: `git checkout src/components/EditorPanel.tsx`
4. Revert package.json dependencies: `git checkout package.json && bun install`
5. Revert App.tsx changes: Remove `tsWorker` prop
6. Revert useCodeExecution.ts: Remove transpilation logic

**Verification after rollback:**
- App works with JavaScript only
- No console errors
- All existing features work

## Resources

### Package Documentation
- [@valtown/codemirror-ts GitHub](https://github.com/val-town/codemirror-ts)
- [CodeMirror 6 Documentation](https://codemirror.net/docs/)
- [TypeScript VFS Documentation](https://github.com/microsoft/TypeScript-Website/tree/v2/packages/typescript-vfs)
- [Comlink Documentation](https://github.com/GoogleChromeLabs/comlink)

### Community Resources
- [CodeMirror Discuss: TypeScript LSP Thread](https://discuss.codemirror.net/t/codemirror-6-and-typescript-lsp/3398)

### Internal Documentation
- `node_modules/bun-types/docs/README.md` - Bun API documentation
- `node_modules/typescript/README.md` - TypeScript compiler documentation

## Open Questions

1. **Should we support multi-file TypeScript projects?**
   - Current plan: Single file only (`/main.tsx`)
   - Future: Could support multiple tabs with cross-file imports

2. **Should we show TypeScript diagnostics (red squiggles) for type errors?**
   - Current plan: No (keep it simple)
   - Future: Could add `@codemirror/lint` with TypeScript diagnostics

3. **Should we support custom type definitions?**
   - Current plan: No (use CDN defaults)
   - Future: Could allow users to add custom `.d.ts` files

4. **Should we cache type definitions?**
   - Current plan: No (load from CDN each time)
   - Future: Could use IndexedDB to cache lib files

## Notes for Engineer

- **Zero codebase context assumed**: This plan provides complete file paths, full code blocks, and exact line numbers
- **Bun-first approach**: Use `bun install`, `bun run`, etc. (per CLAUDE.md)
- **Testing**: Test each phase before moving to next
- **Console logging**: Use `console.log` liberally for debugging during implementation
- **Ask questions**: If anything is unclear, ask before implementing

## Estimated Effort

- **Phase 1-2**: 1 hour (dependencies + worker setup)
- **Phase 3-4**: 1 hour (editor integration)
- **Phase 5**: 30 minutes (execution integration)
- **Phase 6**: 1 hour (testing)
- **Phase 7-8**: 30 minutes (error handling + docs)

**Total**: ~4 hours for full implementation and testing

---

## Summary

This plan adds full TypeScript support to JSPad by:
1. Installing `@valtown/codemirror-ts` and dependencies
2. Creating a TypeScript worker with language service
3. Integrating autocomplete and hover tooltips into CodeMirror
4. Transpiling TypeScript to JavaScript before execution
5. Testing all features work correctly

After implementation, users will be able to:
- Write TypeScript syntax without errors
- Get IntelliSense autocomplete for all types
- See type information on hover
- Execute TypeScript code seamlessly

The implementation is incremental, testable, and includes rollback steps if needed.
