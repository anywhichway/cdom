(function () {
    /* global document, window, MutationObserver, queueMicrotask, XPathResult, Node, NodeFilter, globalThis, console, URL, fetch, setTimeout, clearTimeout */
    const registry = new Map();
    const listeners = new Map();
    const helpers = new Map();
    const expressionCache = new Map();
    const domListeners = new Set();
    let mathParser = null;
    let currentSubscriber = null;
    let domChangeQueued = false;
    const stateExpressionCache = new Map();
    const mountedNodes = new WeakSet();
    const pendingHelpers = new Map();
    const helperWaiters = new Map();
    const schemas = new Map();

    function queueDOMChange() {
        if (domChangeQueued) return;
        domChangeQueued = true;
        queueMicrotask(() => {
            notifyDOMChange();
            domChangeQueued = false;
        });
    }

    function addToScope(scope, name, value) {
        if (!name) return;
        const targetScope = (scope === undefined || scope === window || scope === globalThis) ? null : scope;
        if (!targetScope) {
            registry.set(name, value);
        } else {
            if (!targetScope._lv_state) targetScope._lv_state = {};
            targetScope._lv_state[name] = value;
        }
    }

    function validate(value, schema, path = "") {
        if (!schema) return true;
        const errors = [];
        if (typeof schema === 'string') {
            const resolved = schemas.get(schema);
            if (!resolved) return true;
            return validate(value, resolved, path);
        }

        const type = schema.type;
        const actualType = Array.isArray(value) ? 'array' : (value === null ? 'null' : typeof value);

        if (type && type !== actualType) {
            if (type === 'integer' && Number.isInteger(value)) { /* ok */ }
            else if (type === 'number' && typeof value === 'number') { /* ok */ }
            else {
                errors.push({ path, keyword: 'type', message: `Expected ${type}, got ${actualType}` });
            }
        }

        if (actualType === 'string') {
            if (schema.minLength !== undefined && value.length < schema.minLength) errors.push({ path, keyword: 'minLength' });
            if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push({ path, keyword: 'maxLength' });
            if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push({ path, keyword: 'pattern' });
        } else if (actualType === 'number') {
            if (schema.minimum !== undefined && value < schema.minimum) errors.push({ path, keyword: 'minimum' });
            if (schema.maximum !== undefined && value > schema.maximum) errors.push({ path, keyword: 'maximum' });
        } else if (actualType === 'object' && value !== null) {
            if (schema.required && Array.isArray(schema.required)) {
                for (const key of schema.required) {
                    if (!(key in value)) errors.push({ path: path ? `${path}.${key}` : key, keyword: 'required' });
                }
            }
            if (schema.properties) {
                for (const key in schema.properties) {
                    if (key in value) validate(value[key], schema.properties[key], path ? `${path}.${key}` : key);
                }
            }
        } else if (actualType === 'array') {
            if (schema.minItems !== undefined && value.length < schema.minItems) errors.push({ path, keyword: 'minItems' });
            if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push({ path, keyword: 'maxItems' });
            if (schema.items) {
                value.forEach((item, i) => validate(item, schema.items, `${path}[${i}]`));
            }
        }

        if (schema.enum && !schema.enum.includes(value)) errors.push({ path, keyword: 'enum' });
        if (schema.const !== undefined && value !== schema.const) errors.push({ path, keyword: 'const' });

        if (errors.length > 0) {
            const msg = errors.map(e => `${e.path || 'root'}: failed ${e.keyword}${e.message ? ' (' + e.message + ')' : ''}`).join(', ');
            throw new Error(`Validation Error: ${msg}`);
        }
        return true;
    }

    function schema(name, definition) {
        schemas.set(name, definition);
    }

    function signal(val, options = {}) {
        const name = options.name;
        const storage = options.storage;
        const schema = options.schema;
        const transform = options.transform;

        const applyTransform = (v) => {
            if (!transform) return v;
            const fn = typeof transform === 'function' ? transform : getHelper(transform);
            return fn ? fn(v) : v;
        };

        let value = applyTransform(val);

        if (name && storage) {
            const stored = storage.getItem(name);
            if (stored !== null) {
                try { value = JSON.parse(stored); } catch (e) { /* ignore */ }
            }
        }

        const s = {
            get value() {
                if (name && storage) {
                    const stored = storage.getItem(name);
                    if (stored !== null) {
                        try { value = JSON.parse(stored); } catch (e) { /* ignore */ }
                    }
                }
                if (currentSubscriber) registerDependency(name);
                return value;
            },
            set value(v) {
                const transformed = applyTransform(v);
                if (schema) validate(transformed, schema);
                value = transformed;
                if (name) {
                    if (storage) {
                        storage.setItem(name, JSON.stringify(value));
                    }
                    notify(name, value);
                }
            },
            toString() { return String(this.value); }
        };
        addToScope(options.scope, name, s);
        return s;
    }

    function state(val, options = {}) {
        const name = options.name;
        const storage = options.storage;
        const schema = options.schema;
        const transform = options.transform;

        const applyTransform = (v) => {
            if (!transform) return v;
            const fn = typeof transform === 'function' ? transform : getHelper(transform);
            return fn ? fn(v) : v;
        };

        if (typeof val !== 'object' || val === null) {
            let value = applyTransform(val);
            if (name && storage) {
                const stored = storage.getItem(name);
                if (stored !== null) {
                    try { value = JSON.parse(stored); } catch (e) { /* ignore */ }
                }
            }
            if (name && storage) {
                result = {
                    get value() {
                        const stored = storage.getItem(name);
                        if (stored !== null) {
                            try { value = JSON.parse(stored); } catch (e) { /* ignore */ }
                        }
                        if (currentSubscriber) registerDependency(name);
                        return value;
                    },
                    set value(v) {
                        const transformed = applyTransform(v);
                        if (schema) validate(transformed, schema);
                        value = transformed;
                        storage.setItem(name, JSON.stringify(value));
                        notify(name, value);
                    },
                    toString() { return String(this.value); }
                };
            } else {
                result = value;
            }
        } else {
            // Deep reactive proxy
            const makeReactive = (target, path = [], rootObj = val) => {
                // Initial load for root
                if (path.length === 0 && name && storage) {
                    const stored = storage.getItem(name);
                    if (stored !== null) {
                        try {
                            const parsed = JSON.parse(stored);
                            if (parsed && typeof parsed === 'object') {
                                Object.assign(target, parsed);
                            }
                        } catch (e) { /* ignore */ }
                    }
                }

                return new Proxy(target, {
                    get(t, prop) {
                        if (typeof prop !== 'string' || prop === 'constructor' || prop === 'toJSON') return t[prop];
                        if (prop === '_lv_is_proxy') return true;

                        let currentVal = t[prop];
                        if (name && storage) {
                            const stored = storage.getItem(name);
                            if (stored !== null) {
                                try {
                                    const root = JSON.parse(stored);
                                    let nav = root;
                                    for (const p of path) {
                                        if (nav && typeof nav === 'object') nav = nav[p];
                                        else { nav = undefined; break; }
                                    }
                                    if (nav && typeof nav === 'object' && nav[prop] !== undefined) {
                                        currentVal = nav[prop];
                                    }
                                } catch (e) { /* ignore */ }
                            }
                        }

                        if (currentSubscriber) {
                            registerDependency(name);
                        }

                        // Recursively wrap nested objects
                        if (currentVal && typeof currentVal === 'object' && !Array.isArray(currentVal)) {
                            return makeReactive(currentVal, [...path, prop], rootObj);
                        }
                        return currentVal;
                    },
                    set(t, prop, value) {
                        const transformed = applyTransform(value);
                        if (schema) {
                            // Validate the entire root object after this change would be applied
                            // but since we want to be safe, we can dry-run the change
                            const backup = t[prop];
                            t[prop] = transformed;
                            try {
                                validate(rootObj, schema);
                            } catch (e) {
                                t[prop] = backup;
                                throw e;
                            }
                        } else {
                            t[prop] = transformed;
                        }

                        if (name) {
                            if (storage) {
                                storage.setItem(name, JSON.stringify(rootObj));
                            }
                            notify(name, rootObj);
                        }
                        return true;
                    }
                });
            };
            result = makeReactive(val);
        }
        addToScope(options.scope, name, result);
        return result;
    }

    function registerDependency(name) {
        if (!name || !currentSubscriber) return;
        let subs = listeners.get(name);
        if (!subs) {
            subs = new Set();
            listeners.set(name, subs);
        }
        subs.add(currentSubscriber);
    }

    function helper(name, fn) {
        helpers.set(name, fn);
    }

    function notify(name, value) {
        const subs = listeners.get(name);
        if (!subs) return;
        for (const sub of subs) {
            refreshSubscriber(sub);
        }
    }

    function refreshSubscriber(sub) {
        const { node, attr, expression, contextNode, fn, wasString, unsafe } = sub;

        if (!node.isConnected && !(node instanceof Attr && node.ownerElement?.isConnected)) return;

        if (fn) {
            currentSubscriber = sub;
            const result = fn();
            currentSubscriber = null;

            // Ensure we always have a stable node for the subscriber
            let newNode = cdomToDOM(result, wasString, unsafe, contextNode);
            if (newNode && newNode.nodeType === 11) { // Fragment
                const wrap = document.createElement('span');
                wrap.style.display = 'contents';
                wrap.appendChild(newNode);
                newNode = wrap;
            }

            if (node !== newNode) {
                node.replaceWith(newNode);
                sub.node = newNode;
                newNode._lv_sub = sub;
            }
        } else if (attr) {
            const expressions = extractExpressions(attr.value);
            let newValue = attr.originalValue || attr.value;
            for (const expr of expressions) {
                if (expr.type === '_') {
                    currentSubscriber = sub;
                    const res = evaluateStateExpression(expr.expression, contextNode);
                    currentSubscriber = null;
                    newValue = newValue.replace(expr.fullMatch, String(res));
                } else {
                    const res = evaluateExpression(expr.expression, contextNode, false, '$');
                    newValue = newValue.replace(expr.fullMatch, String(res.value));
                }
            }
            if (node.ownerElement.getAttribute(node.name) !== newValue) {
                node.ownerElement.setAttribute(node.name, newValue);
            }
        } else if (node.nodeType === Node.TEXT_NODE || (node.nodeType === 1 && node.style.display === 'contents')) {
            if (expression) {
                currentSubscriber = sub;
                const result = evaluateStateExpression(expression, contextNode);
                currentSubscriber = null;
                const isCDOM = result && typeof result === 'object' && !Array.isArray(result) && !result.nodeType && !('value' in result);
                if (isCDOM) {
                    const newNode = cdomToDOM(result, wasString, unsafe, contextNode);
                    node.replaceWith(newNode);
                    sub.node = newNode;
                    newNode._lv_sub = sub;
                } else {
                    const newVal = String((result && typeof result === 'object' && 'value' in result) ? result.value : result);
                    if (node.nodeType === 1) node.textContent = newVal;
                    else if (node.nodeValue !== newVal) node.nodeValue = newVal;
                }
            } else {
                const expressions = extractExpressions(node.originalValue || node.nodeValue);
                let text = node.originalValue || node.nodeValue;
                for (const expr of expressions) {
                    const res = evaluateExpression(expr.expression, contextNode, false, expr.type);
                    text = text.replace(expr.fullMatch, String(res.value));
                }
                if (node.nodeValue !== text) node.nodeValue = text;
            }
        }
    }

    // Callable API functions
    // When called without context, these return expression strings for lazy cDOM binding
    // When called with context, they evaluate immediately
    const _ = (expression, contextNode) => {
        if (contextNode === undefined) {
            // No context = lazy binding for cDOM markup
            return `_(${expression})`;
        }
        // With context = immediate evaluation
        return evaluateStateExpression(expression, contextNode);
    };
    const $ = (expression, contextNode) => {
        if (contextNode === undefined) {
            // No context = lazy binding for cDOM markup
            return `$(${expression})`;
        }
        // With context = immediate evaluation
        return evaluateExpression(expression, contextNode, true, '$').value;
    };

    helpers.set('_', (...args) => {
        const expr = args[0];
        const ctx = currentSubscriber?.contextNode || args[1];
        return _(expr, ctx);
    });
    helpers.set('$', (...args) => {
        const expr = args[0];
        const ctx = currentSubscriber?.contextNode || args[1];
        return $(expr, ctx);
    });

    // Transformation Helpers
    helpers.set('Integer', v => parseInt(v));
    helpers.set('Number', v => Number(v));
    helpers.set('String', v => String(v));
    helpers.set('Boolean', v => !!v);

    function getHelper(name) {
        if (helpers.has(name)) return helpers.get(name);

        const parts = name.split('.');
        let obj = globalThis;
        for (let i = 0; i < parts.length; i++) {
            obj = obj?.[parts[i]];
        }
        if (typeof obj === 'function') {
            helpers.set(name, obj);
            return obj;
        }

        loadHelper(name);
        return undefined;
    }

    async function loadHelper(name) {
        if (pendingHelpers.has(name)) return pendingHelpers.get(name);

        const promise = (async () => {
            try {
                const path = name.toLowerCase().replace(/\./g, '/') + '.js';
                const cdomPath = cDOM.script ? cDOM.script.src : window.location.href;
                const base = cdomPath.substring(0, cdomPath.lastIndexOf('/') + 1) + 'helpers/';
                const url = `${base}${path}`;
                const module = await import(url);
                const fn = module.default;

                if (typeof fn === 'function') {
                    helpers.set(name, fn);

                    const parts = name.split('.');
                    if (parts.length > 1) {
                        let obj = globalThis;
                        for (let i = 0; i < parts.length - 1; i++) {
                            const part = parts[i];
                            if (!obj[part]) obj[part] = {};
                            obj = obj[part];
                        }
                        const leaf = parts[parts.length - 1];
                        if (obj[leaf] === undefined) obj[leaf] = fn;
                    }
                } else {
                    helpers.set(name, null);
                }
            } catch (e) {
                helpers.set(name, null);
            }

            const waiters = helperWaiters.get(name);
            if (waiters) {
                for (const sub of waiters) refreshSubscriber(sub);
                helperWaiters.delete(name);
            }
            pendingHelpers.delete(name);
        })();

        pendingHelpers.set(name, promise);
        return promise;
    }

    function suspendSubscriber(name, sub) {
        if (!sub) return;
        let set = helperWaiters.get(name);
        if (!set) {
            set = new Set();
            helperWaiters.set(name, set);
        }
        set.add(sub);
    }

    function scanForHelpers(expression) {
        const helperRegex = /\b([\w.]+)\s*\(/g;
        let match;
        while ((match = helperRegex.exec(expression)) !== null) {
            const name = match[1];
            if (!['_', '$', 'if', 'else', 'for', 'while', 'switch', 'typeof', 'instanceof'].includes(name)) {
                getHelper(name);
            }
        }
    }

    function findInScope(node, name) {
        let curr = node;
        while (curr) {
            if (curr._lv_state && curr._lv_state[name] !== undefined) {
                return curr._lv_state[name];
            }
            curr = curr.parentNode || curr.host || curr._lv_parent;
        }
        return registry.get(name);
    }

    function evaluateStateExpression(expression, contextNode, event) {
        let compiled = stateExpressionCache.get(expression);
        if (!compiled) {
            compiled = compileStateExpression(expression);
            stateExpressionCache.set(expression, compiled);
        }
        return compiled(contextNode, event);
    }

    function compileStateExpression(expression) {
        const expr = expression.trim();

        if (expr === '$this') return (ctx) => ctx;
        if (expr === '$event') return (ctx, ev) => ev;

        // Literals (Strings & Numbers)
        if ((expr.startsWith("'") && expr.endsWith("'")) || (expr.startsWith('"') && expr.endsWith('"'))) {
            const val = expr.slice(1, -1);
            return () => val;
        }
        if (!isNaN(expr) && !isNaN(parseFloat(expr))) {
            const val = Number(expr);
            return () => val;
        }
        if (expr === 'true') return () => true;
        if (expr === 'false') return () => false;
        if (expr === 'null') return () => null;

        // Object literals: {key: value, ...}
        if (expr.startsWith('{') && expr.endsWith('}')) {
            try {
                // Use Function constructor to safely evaluate the object literal
                const fn = new Function('return (' + expr + ')');
                const obj = fn();
                return () => obj;
            } catch (e) {
                return () => ({ error: 'Invalid object literal' });
            }
        }

        // Array literals: [item, item, ...]
        if (expr.startsWith('[') && expr.endsWith(']')) {
            try {
                const fn = new Function('return (' + expr + ')');
                const arr = fn();
                return () => arr;
            } catch (e) {
                return () => [];
            }
        }

        // Helpers: name(arg, arg)
        const callMatch = expr.match(/^([\w.]+)\(([\s\S]*)\)$/);
        if (callMatch) {
            const funcName = callMatch[1];
            const argsStr = callMatch[2];
            const argExprs = [];
            if (argsStr) {
                let current = '';
                let parenDepth = 0;
                let braceDepth = 0;
                let bracketDepth = 0;
                let inString = false;
                let stringChar = null;

                for (let i = 0; i < argsStr.length; i++) {
                    const char = argsStr[i];
                    const prevChar = i > 0 ? argsStr[i - 1] : null;

                    // Track string boundaries
                    if ((char === '"' || char === "'") && prevChar !== '\\') {
                        if (!inString) {
                            inString = true;
                            stringChar = char;
                        } else if (char === stringChar) {
                            inString = false;
                            stringChar = null;
                        }
                    }

                    // Only track depth outside of strings
                    if (!inString) {
                        if (char === '(') parenDepth++;
                        else if (char === ')') parenDepth--;
                        else if (char === '{') braceDepth++;
                        else if (char === '}') braceDepth--;
                        else if (char === '[') bracketDepth++;
                        else if (char === ']') bracketDepth--;
                    }

                    // Split on comma only at depth 0
                    if (char === ',' && parenDepth === 0 && braceDepth === 0 && bracketDepth === 0 && !inString) {
                        argExprs.push(current.trim());
                        current = '';
                    } else {
                        current += char;
                    }
                }
                argExprs.push(current.trim());
            }
            const argFns = argExprs.map(ae => compileStateExpression(ae));
            return (ctx, ev) => {
                const fn = getHelper(funcName);
                if (fn === undefined) {
                    suspendSubscriber(funcName, currentSubscriber);
                    return '...';
                }
                if (fn === null) return `[${funcName} undefined]`;
                const args = new Array(argFns.length);
                for (let i = 0; i < argFns.length; i++) {
                    const argVal = argFns[i](ctx, ev);
                    // Unwrap Path Objects or Signals
                    if (argVal && typeof argVal === 'object') {
                        if ('value' in argVal) args[i] = argVal.value;
                        else if (argVal.toString() !== '[object Object]') args[i] = argVal; // Keep as is if it's a special object
                        else args[i] = argVal; // Fallback
                    } else {
                        args[i] = argVal;
                    }
                }
                const result = fn(...args);
                return result;
            };
        }

        // Math/Logic expressions (contains operators)
        if (/[+\-*%^<>=!&|?:]/.test(expr)) {
            return (ctx, ev) => {
                if (!mathParser && typeof globalThis.exprEval !== 'undefined') {
                    mathParser = new globalThis.exprEval.Parser();
                }
                if (!mathParser) return expr;
                try {
                    const scope = {};
                    // Regex matches paths starting with / or ./ 
                    const processedExpr = expr.replace(/((?:\.{1,2}\/|\/)[\w]+(?:\/[\w]+)*)/g, (match) => {
                        const val = evaluateStateExpression(match, ctx, ev);
                        const resolved = (val && typeof val === 'object' && 'value' in val) ? val.value : val;
                        const id = 'v_' + Math.random().toString(36).substr(2, 5);
                        scope[id] = resolved;
                        return id;
                    });
                    return mathParser.evaluate(processedExpr, scope);
                } catch (e) { return `[Math Error]`; }
            };
        }

        // Paths: Must start with / or ./
        if (expr.startsWith('/') || expr.startsWith('./')) {
            const offset = expr.startsWith('./') ? 2 : 1;
            return createPathFunction(expr.substring(offset), 'state');
        }

        // Specialized context paths: $this.prop or $event.prop
        if (expr.startsWith('$this.') || expr.startsWith('$this/')) return createPathFunction(expr.substring(6), '$this');
        if (expr.startsWith('$event.') || expr.startsWith('$event/')) return createPathFunction(expr.substring(7), '$event');

        // Fallback: Anything else is a literal string
        return () => expr;
    }

    function createPathFunction(pathStr, type) {
        if (pathStr.includes('..')) {
            throw new Error(`Invalid path '${pathStr}': Explicit parent navigation '..' is not supported in state paths. Use plain names (e.g., 'user/name') which automatically bubble up to find the nearest matching state.`);
        }
        const parts = pathStr.split(/[./]/).filter(p => p !== '');
        const name = parts[0];
        const path = parts.slice(1);

        return (ctx, ev) => {
            let root;
            if (type === '$this') root = ctx;
            else if (type === '$event') root = ev;
            else root = findInScope(ctx, name);

            if (!root) return (type === 'state') ? `[Unknown: ${name}]` : undefined;

            // For root-only access
            if (path.length === 0) {
                if (type === 'state' && currentSubscriber) registerDependency(name);
                return root;
            }

            return resolvePath(root, path, type === 'state' ? name : null);
        };
    }

    function resolvePath(root, path, contextName) {
        if (path.length === 0) return root;

        let target = root;
        if (root && typeof root === 'object' && 'value' in root) {
            target = root.value;
        }

        for (let i = 0; i < path.length - 1; i++) {
            target = target[path[i]];
            if (!target || typeof target !== 'object') return undefined;
        }

        const key = path[path.length - 1];
        if (target === undefined || target === null) return undefined;

        if (currentSubscriber) registerDependency(contextName);

        return {
            target,
            key,
            get value() { return target[key]; },
            set value(v) {
                target[key] = v;
                if (contextName) notify(contextName, target);
            },
            valueOf() { return this.value; },
            toString() { return String(this.value); }
        };
    }

    function extractExpressions(text) {
        if (expressionCache.has(text)) return expressionCache.get(text);

        const expressions = [];
        let i = 0;
        while (i < text.length) {
            const char = text[i];
            if ((char === '$' || char === '_' || char === '#' || char === '=') && text[i + 1] === '(') {
                // Normalize aliases: # -> $, = -> _
                const type = (char === '#') ? '$' : (char === '=') ? '_' : char;
                const start = i;
                i += 2;
                let depth = 1;
                let expr = '';

                while (i < text.length && depth > 0) {
                    if (text[i] === '(') depth++;
                    else if (text[i] === ')') depth--;

                    if (depth > 0) expr += text[i];
                    i++;
                }

                if (depth === 0) {
                    const match = { type, start, end: i, expression: expr, fullMatch: text.substring(start, i) };
                    expressions.push(match);
                    if (type === '_') scanForHelpers(expr);
                }
            } else {
                i++;
            }
        }
        expressionCache.set(text, expressions);
        return expressions;
    }

    function isXPath(expression) {
        const xpathIndicators = [
            /^\/\//, /^\//, /^\.\//, /^\.\.\//, /\.\//, /\.\.\//, /@[\w-]+/, /\bcount\(/, /\btext\(/,
            /\bnode\(/, /\bposition\(/, /\blast\(/, /\bsum\(/, /\bconcat\(/, /\bcontains\(/,
            /\bstarts-with\(/, /\bstring\(/, /\bnumber\(/, /\bboolean\(/, /::/,
        ];
        return xpathIndicators.some(pattern => pattern.test(expression));
    }

    function evaluateExpression(expression, contextNode, returnNodes = false, type = '$', event) {
        if (type === '_') {
            return { type: 'value', value: evaluateStateExpression(expression, contextNode, event) };
        }
        return isXPath(expression)
            ? evaluateXPath(expression, contextNode, returnNodes)
            : evaluateCSS(expression, contextNode, returnNodes);
    }

    function evaluateCSS(selector, contextNode, returnNodes = false) {
        try {
            const context = contextNode?.nodeType === 1
                ? contextNode
                : contextNode?.parentElement || document;

            const elements = Array.from(context.querySelectorAll(selector));

            if (elements.length === 0) return { type: 'value', value: '' };
            if (returnNodes) return { type: 'nodes', value: elements };

            return { type: 'value', value: elements.map(el => el.textContent || '').join(', ') };
        } catch (e) {
            return { type: 'value', value: `[CSS Error: ${selector}]` };
        }
    }

    function evaluateXPath(expression, contextNode, returnNodes = false) {
        try {
            const result = document.evaluate(
                expression,
                contextNode || document,
                null,
                XPathResult.ANY_TYPE,
                null
            );

            switch (result.resultType) {
                case XPathResult.NUMBER_TYPE: return { type: 'value', value: result.numberValue };
                case XPathResult.STRING_TYPE: return { type: 'value', value: result.stringValue };
                case XPathResult.BOOLEAN_TYPE: return { type: 'value', value: result.booleanValue };
                case XPathResult.UNORDERED_NODE_ITERATOR_TYPE:
                case XPathResult.ORDERED_NODE_ITERATOR_TYPE:
                    const nodes = [];
                    let node = result.iterateNext();
                    while (node) {
                        nodes.push(node);
                        node = result.iterateNext();
                    }
                    if (returnNodes && nodes.length > 0) return { type: 'nodes', value: nodes };
                    return { type: 'value', value: nodes.map(n => n.textContent || n.nodeValue).join(', ') };
                case XPathResult.FIRST_ORDERED_NODE_TYPE:
                case XPathResult.ANY_UNORDERED_NODE_TYPE:
                    if (returnNodes && result.singleNodeValue) return { type: 'nodes', value: [result.singleNodeValue] };
                    return { type: 'value', value: result.singleNodeValue?.textContent || result.singleNodeValue?.nodeValue || '' };
                default: return { type: 'value', value: '' };
            }
        } catch (e) {
            return { type: 'value', value: `[XPath Error: ${expression}]` };
        }
    }

    function notifyDOMChange() {
        for (const sub of domListeners) {
            if (!sub.node.isConnected && !(sub.node instanceof Attr && sub.node.ownerElement?.isConnected)) {
                domListeners.delete(sub);
                continue;
            }
            if (sub.attr) {
                const expressions = extractExpressions(sub.attr.value);
                let newValue = sub.attr.originalValue || sub.attr.value;
                for (const expr of expressions) {
                    if (expr.type === '$') {
                        const res = evaluateExpression(expr.expression, sub.contextNode, false, '$');
                        newValue = newValue.replace(expr.fullMatch, String(res.value));
                    }
                }
                if (sub.node.ownerElement.getAttribute(sub.node.name) !== newValue) {
                    sub.node.ownerElement.setAttribute(sub.node.name, newValue);
                }
            } else {
                const res = evaluateExpression(sub.expression, sub.contextNode, false, '$');
                const newValue = String(res.value);
                if (sub.node.nodeValue !== newValue) {
                    sub.node.nodeValue = newValue;
                }
            }
        }
    }

    function cdomToDOM(onode, wasString, unsafe, context) {
        if (onode === null || onode === undefined) return null;

        if (typeof onode === 'function') {
            const placeholder = document.createComment('fx');
            const fn = () => onode.call(context);
            const sub = { node: placeholder, fn, contextNode: context, wasString, unsafe };
            placeholder._lv_sub = sub;
            currentSubscriber = sub;
            const initial = fn();
            currentSubscriber = null;
            let dom = cdomToDOM(initial, wasString, unsafe, context);
            if (dom) {
                if (dom.nodeType === 11) { // Fragment
                    const wrap = document.createElement('span');
                    wrap.style.display = 'contents';
                    wrap.appendChild(dom);
                    dom = wrap;
                }
                sub.node = dom;
                dom._lv_sub = sub;
                return dom;
            }
            return placeholder;
        }

        if (typeof onode !== 'object') {
            const node = document.createTextNode(onode);
            processTextNode(node, context, wasString, unsafe);
            return node;
        }

        if (Array.isArray(onode)) {
            const frag = document.createDocumentFragment();
            for (const node of onode) {
                const childNode = cdomToDOM(node, wasString, unsafe, context);
                if (childNode) frag.appendChild(childNode);
            }
            return frag;
        }

        let tag;
        for (tag in onode) break;
        if (!tag) return document.createDocumentFragment();

        const content = onode[tag];
        const el = document.createElement(tag);
        if (context) Object.defineProperty(el, '_lv_parent', { value: context, enumerable: false, configurable: true });

        // Path A: Properties Object (Detailed definitions)
        if (typeof content === 'object' && content !== null && !Array.isArray(content)) {
            if (content.oncreate) {
                const val = content.oncreate;
                if (typeof val === "string" && (val.startsWith('_(') || val.startsWith('=('))) {
                    // Remove trailing semicolon if present
                    const trimmed = val.trim().replace(/;$/, '');
                    if (trimmed.endsWith(')')) {
                        const expr = trimmed.substring(2, trimmed.length - 1);
                        try { evaluateStateExpression(expr, el); } catch (e) { /* ignore */ }
                    }
                } else if (typeof val === 'function') {
                    try { val.call(el); } catch (e) { /* ignore */ }
                }
            }
            if (content.onmount) {
                const val = content.onmount;
                if (typeof val === "string" && (val.startsWith('_(') || val.startsWith('=(')) && val.endsWith(')')) {
                    const expr = val.substring(2, val.length - 1);
                    el.onmount = () => {
                        try { evaluateStateExpression(expr, el); } catch (e) { /* ignore */ }
                    };
                } else {
                    el.onmount = content.onmount;
                }
            }

            for (const key in content) {
                const val = content[key];
                if (key === 'children') {
                    if (Array.isArray(val)) {
                        const len = val.length;
                        if (len > 1) {
                            const frag = document.createDocumentFragment();
                            for (let i = 0; i < len; i++) {
                                const childNode = cdomToDOM(val[i], wasString, unsafe, el);
                                if (childNode) frag.appendChild(childNode);
                            }
                            el.appendChild(frag);
                        } else if (len === 1) {
                            const childNode = cdomToDOM(val[0], wasString, unsafe, el);
                            if (childNode) el.appendChild(childNode);
                        }
                    } else {
                        const childNode = cdomToDOM(val, wasString, unsafe, el);
                        if (childNode) el.appendChild(childNode);
                    }
                } else if (key === 'class') {
                    el.className = val;
                } else if (key === 'style' && typeof val === 'object' && val !== null && !Array.isArray(val)) {
                    for (const s in val) el.style[s] = val[s];
                } else if (key === 'oncreate' || key === 'onmount') {
                    continue;
                } else if (key.startsWith('on')) {
                    if (typeof val === "string") {
                        if (val.startsWith('_(') && val.endsWith(')')) {
                            const expr = val.substring(2, val.length - 1);
                            el[key] = (event) => evaluateStateExpression(expr, el, event);
                        } else if (!wasString || unsafe) {
                            try { el[key] = new Function("event", val); } catch (e) { el.setAttribute(key, val); }
                        } else { el.setAttribute(key, val); }
                    } else { el[key] = val; }
                } else {
                    el.setAttribute(key, val);
                    const hasExpr = typeof val === 'string' && (val.includes('$(') || val.includes('_(') || val.includes('#(') || val.includes('=('));
                    if (hasExpr) {
                        processAttribute(el, el.getAttributeNode(key));
                    }
                }
            }
        }
        // Path B: Direct Content (Shorthand or template)
        else {
            if (typeof content === 'function') {
                const dom = cdomToDOM(content, wasString, unsafe, el);
                if (dom) el.appendChild(dom);
            } else if (Array.isArray(content)) {
                const len = content.length;
                if (len > 1) {
                    const frag = document.createDocumentFragment();
                    for (let i = 0; i < len; i++) {
                        const childNode = cdomToDOM(content[i], wasString, unsafe, el);
                        if (childNode) frag.appendChild(childNode);
                    }
                    el.appendChild(frag);
                } else if (len === 1) {
                    const childNode = cdomToDOM(content[0], wasString, unsafe, el);
                    if (childNode) el.appendChild(childNode);
                }
            } else if (content !== undefined && content !== null) {
                const childNode = cdomToDOM(content, wasString, unsafe, el);
                if (childNode) el.appendChild(childNode);
            }
        }

        return el;
    }

    function processAttribute(element, attr) {
        const expressions = extractExpressions(attr.value);
        if (expressions.length === 0) return;
        if (!attr.originalValue) attr.originalValue = attr.value;

        let newValue = attr.value;
        for (const expr of expressions) {
            if (expr.type === '_') {
                if (!attr._lv_sub) attr._lv_sub = { node: attr, attr, contextNode: element };
                currentSubscriber = attr._lv_sub;
                currentSubscriber.expression = expr.expression;
                const res = evaluateStateExpression(expr.expression, element);
                newValue = newValue.replace(expr.fullMatch, String(res));
                currentSubscriber = null;
            } else {
                const res = evaluateExpression(expr.expression, element, false, '$');
                newValue = newValue.replace(expr.fullMatch, String(res.value));
                domListeners.add({ node: attr, attr, contextNode: element });
            }
        }
        element.setAttribute(attr.name, newValue);
    }

    function processTextNode(textNode, context, wasString, unsafe) {
        const text = textNode.nodeValue;
        if (!text || (!text.includes('$(') && !text.includes('_(') && !text.includes('#(') && !text.includes('=('))) return;

        const expressions = extractExpressions(text);
        if (expressions.length === 0) return;

        const parent = context || textNode.parentNode || textNode.parentElement;
        const trimmedText = text.trim();

        // Special case: single expression that might return a cDOM object
        if (expressions.length === 1 && expressions[0].fullMatch.trim() === trimmedText) {
            const expr = expressions[0];
            if (expr.type === '_') {
                if (!textNode._lv_sub) textNode._lv_sub = { node: textNode, expression: expr.expression, contextNode: parent, wasString, unsafe };
                currentSubscriber = textNode._lv_sub;
                const result = evaluateStateExpression(expr.expression, parent);
                const isCDOM = result && typeof result === 'object' && !Array.isArray(result) && !result.nodeType && !('value' in result);
                if (isCDOM) {
                    const dom = cdomToDOM(result, wasString, unsafe, parent);
                    textNode.replaceWith(dom);
                    textNode._lv_sub.node = dom;
                    dom._lv_sub = textNode._lv_sub;
                } else {
                    const newValue = String((result && typeof result === 'object' && 'value' in result) ? result.value : result);
                    if (textNode.nodeValue !== newValue) textNode.nodeValue = newValue;
                }
                currentSubscriber = null;
            } else {
                const result = evaluateExpression(expr.expression, parent, true, '$');
                if (result.type === 'nodes') {
                    const fragment = document.createDocumentFragment();
                    for (const n of result.value) {
                        try { fragment.appendChild(n.cloneNode(true)); } catch (e) { /* ignore */ }
                    }
                    const container = document.createElement('span');
                    container.style.display = 'contents';
                    container.appendChild(fragment);
                    textNode.replaceWith(container);
                    domListeners.add({ node: container, expression: expr.expression, contextNode: parent, wasString, unsafe });
                } else {
                    const newValue = String(result.value);
                    if (textNode.nodeValue !== newValue) textNode.nodeValue = newValue;
                    if (!domListeners.has(textNode)) {
                        domListeners.add({ node: textNode, expression: expr.expression, contextNode: parent, wasString, unsafe });
                    }
                }
            }
        } else {
            // General case: evaluate and replace multiple expressions (always results in string)
            if (!textNode.originalValue) textNode.originalValue = text;
            let currentText = text;
            for (const expr of expressions) {
                const res = evaluateExpression(expr.expression, parent, false, expr.type);
                currentText = currentText.replace(expr.fullMatch, String(res.value));
                if (expr.type === '_') {
                    // For state expressions in mixed text, we use a subscriber that updates the whole node
                    registerDependency(expr.expression.split('/')[1]); // Simple dependency registration
                    listeners.get(expr.expression.split('/')[1])?.add({ node: textNode, contextNode: parent, wasString, unsafe });
                } else {
                    domListeners.add({ node: textNode, contextNode: parent, wasString, unsafe });
                }
            }
            textNode.nodeValue = currentText;
        }
    }

    // call with no options when using to simply construct a DOM element
    // call with options to insert into the DOM
    const cDOM = (cdom, options, script = document.currentScript) => {
        const type = typeof cdom;
        if (type === 'string') {
            cdom = JSON.parse(cdom);
        }
        const dom = cdomToDOM(cdom, type === 'string', options?.unsafe, options?.context);
        if (options) {
            let { target = script, location = 'outerHTML' } = options;
            location = location.toLowerCase();
            if (location === 'outerhtml') target.replaceWith(dom);
            else if (location === 'innerhtml') { target.replaceChildren(dom); }
            else if (location === 'beforebegin') { target.insertAdjacentElement('beforebegin', dom); }
            else if (location === 'afterbegin') { target.insertAdjacentElement('afterbegin', dom); }
            else if (location === 'beforeend') { target.insertAdjacentElement('beforeend', dom); }
            else if (location === 'afterend') { target.insertAdjacentElement('afterend', dom); }
            else if (location === 'shadow') {
                if (!target.shadowRoot) target.attachShadow({ mode: 'open' });
                target.shadowRoot.replaceChildren(dom);
            }
        }
        return dom;
    }

    // Standalone src/href handling
    const nativeSrcTags = new Set(['img', 'script', 'iframe', 'video', 'audio', 'source', 'track', 'embed']);

    async function handleSrc(element, srcValue) {
        const tag = element.tagName.toLowerCase();
        if (nativeSrcTags.has(tag)) return; // Don't override native behavior

        if (!srcValue) {
            element.replaceChildren();
            return;
        }

        // Check if it's a CSS selector (doesn't start with http/https or /)
        if (!srcValue.startsWith('http') && !srcValue.startsWith('/') && !srcValue.startsWith('./') && !srcValue.startsWith('../')) {
            try {
                const source = document.querySelector(srcValue);
                if (source) {
                    element.replaceChildren(...Array.from(source.childNodes).map(n => n.cloneNode(true)));
                    return;
                }
            } catch (e) { /* Not a valid selector, try as URL */ }
        }

        // Treat as URL
        try {
            const method = element.getAttribute('data-method') || 'GET';
            let body = element.getAttribute('data-body');
            const bodySelector = element.getAttribute('data-body-selector');
            if (bodySelector) {
                const source = document.querySelector(bodySelector);
                if (source) {
                    body = 'checked' in source ? source.checked : 'value' in source ? source.value : source.textContent;
                }
            }
            const url = new URL(srcValue, window.location.href);
            const options = { method };
            if (body) options.body = body;
            const response = await fetch(url.href);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const contentType = response.headers.get('content-type') || '';
            const text = await response.text();

            // Determine how to handle content
            const isCDOM = srcValue.endsWith('.cdom') || contentType.includes('application/cdom');
            const isHTML = contentType.includes('text/html') || srcValue.endsWith('.html') || srcValue.endsWith('.htm');

            if (isCDOM) {
                const cdomData = JSON.parse(text);
                const dom = cdomToDOM(cdomData, true, false, element);
                element.replaceChildren(dom);
            } else if (isHTML) {
                element.innerHTML = text;
            } else {
                // Other content types - display in <pre>
                const pre = document.createElement('pre');
                pre.textContent = text;
                element.replaceChildren(pre);
            }
        } catch (e) {
            element.innerHTML = `<div style="color:red;">Failed to load: ${srcValue}</div>`;
        }
    }

    function handleNonStandardHref(event) {
        const element = event.currentTarget;
        const href = element.getAttribute('href');
        if (!href) return;

        event.preventDefault();

        // Parse hash if present
        const hashIndex = href.indexOf('#');
        const path = hashIndex >= 0 ? href.substring(0, hashIndex) : href;
        const hash = hashIndex >= 0 ? href.substring(hashIndex + 1) : null;

        // Determine targets
        const targetAttr = element.getAttribute('target') || 'self';
        let targets = [];

        if (targetAttr === 'self') {
            targets = [element];
        } else {
            try {
                targets = Array.from(document.querySelectorAll(targetAttr));
            } catch (e) {
                return;
            }
        }

        // Set src on all targets
        for (const target of targets) {
            target.setAttribute('src', path);
        }

        // Scroll to hash after a brief delay to allow content to load
        if (hash) {
            setTimeout(() => {
                const hashTarget = document.getElementById(hash);
                if (hashTarget) {
                    hashTarget.scrollIntoView({ behavior: 'smooth' });
                }
            }, 100);
        }
    }

    // Export to global scope
    cDOM.signal = signal;
    cDOM.state = state;
    cDOM.helper = helper;
    cDOM.schema = schema;
    cDOM.validate = validate;
    cDOM._ = _;
    cDOM.$ = $;
    cDOM.script = document.currentScript;

    globalThis.cDOM = cDOM;
    globalThis._ = _;
    globalThis.$ = $;

    // Register core helpers
    helpers.set('state', state);
    helpers.set('signal', signal);

    const observer = new MutationObserver((mutations) => {
        let changed = false;
        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === 1) { // ELEMENT_NODE
                        const process = (el) => {
                            // Handle onmount
                            if (el.onmount && !mountedNodes.has(el)) {
                                mountedNodes.add(el);
                                try { el.onmount.call(el); } catch (e) { /* ignore */ }
                            }

                            // Handle src attribute
                            const tag = el.tagName.toLowerCase();
                            if (el.hasAttribute('src') && !nativeSrcTags.has(tag)) {
                                handleSrc(el, el.getAttribute('src'));
                            }

                            // Handle href attribute (non-<a> tags only)
                            if (el.hasAttribute('href') && tag !== 'a') {
                                if (!el.onclick) {
                                    el.onclick = handleNonStandardHref;
                                }
                            }
                        };
                        process(node);
                        const all = node.querySelectorAll('*');
                        for (const el of all) process(el);
                    }
                }
                changed = true;
            } else if (mutation.type === 'attributes') {
                const el = mutation.target;
                if (mutation.attributeName === 'src') {
                    const tag = el.tagName.toLowerCase();
                    if (!nativeSrcTags.has(tag)) {
                        handleSrc(el, el.getAttribute('src'));
                    }
                } else if (mutation.attributeName === 'href') {
                    const tag = el.tagName.toLowerCase();
                    if (tag !== 'a') {
                        if (el.hasAttribute('href') && !el.onclick) {
                            el.onclick = handleNonStandardHref;
                        }
                    }
                }
                changed = true;
            } else if (mutation.type === 'characterData') {
                changed = true;
            }
        }
        if (changed) queueDOMChange();
    });

    observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true
    });
})();
