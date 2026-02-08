(function () {
    /* global document, window, MutationObserver, queueMicrotask, XPathResult, Node, NodeFilter, globalThis, console, URL, setTimeout, clearTimeout */
    const symbolicOperators = new Map([
        ['+', 'add'], ['-', 'subtract'], ['*', 'multiply'], ['/', 'divide'],
        ['==', 'eq'], ['!=', 'neq'], ['>', 'gt'], ['<', 'lt'], ['>=', 'gte'], ['<=', 'lte'],
        ['&&', 'and'], ['||', 'or'], ['!', 'not'], ['++', 'increment'], ['--', 'decrement']
    ]);

    const registry = new Map();
    const listeners = new Map();
    const helpers = new Map();
    const expressionCache = new Map();
    const domListeners = new Set();
    let currentSubscriber = null;
    let domChangeQueued = false;
    const stateExpressionCache = new Map();
    const mountedNodes = new WeakSet();
    const pendingHelpers = new Map();
    const helperWaiters = new Map();
    const schemas = new Map();

    function unwrap(val) {
        if (val && typeof val === 'object' && 'value' in val) return val.value;
        return val;
    }

    const getStorage = (s) => {
        if (!s) return null;
        if (typeof s === 'object') return s;
        try {
            if (s === 'localStorage' || s === 'window.localStorage') return globalThis.localStorage;
            if (s === 'sessionStorage' || s === 'window.sessionStorage') return globalThis.sessionStorage;
        } catch (e) { /* Storage might be blocked */ }
        return null;
    };


    function createExpression(text) {
        let at = 0;
        const tokens = tokenize(text);

        function tokenize(src) {
            const results = [];
            const tokenRegex = /\s*(\d*\.\d+|\d+|"([^"\\]|\\.)*"|'([^'\\]|\\.)*'|=\/|\.{1,2}\/|\/|\$this|\$event|[a-zA-Z_$][\w$]*|==|!=|<=|>=|&&|\|\||[-+*/%^<>!?:.,(){}[\]])\s*/g;
            let match;
            while ((match = tokenRegex.exec(src)) !== null) {
                results.push(match[1]);
            }
            return results;
        }

        function peek(offset = 0) { return tokens[at + offset]; }
        function next() { return tokens[at++]; }
        function consume(expected) {
            const t = next();
            if (t !== expected) throw new Error(`Expected "${expected}" but found "${t}"`);
            return t;
        }

        function parseTernary() {
            let node = parseLogicalOR();
            if (peek() === '?') {
                next();
                const left = parseTernary();
                consume(':');
                const right = parseTernary();
                const cond = node;
                node = (ctx, ev) => cond(ctx, ev) ? left(ctx, ev) : right(ctx, ev);
            }
            return node;
        }

        function parseLogicalOR() {
            let node = parseLogicalAND();
            while (peek() === '||') {
                next();
                const right = parseLogicalAND();
                const left = node;
                node = (ctx, ev) => left(ctx, ev) || right(ctx, ev);
            }
            return node;
        }

        function parseLogicalAND() {
            let node = parseEquality();
            while (peek() === '&&') {
                next();
                const right = parseEquality();
                const left = node;
                node = (ctx, ev) => left(ctx, ev) && right(ctx, ev);
            }
            return node;
        }

        function parseEquality() {
            let node = parseRelational();
            while (peek() === '==' || peek() === '!=') {
                const op = next();
                const right = parseRelational();
                const left = node;
                if (op === '==') node = (ctx, ev) => left(ctx, ev) == right(ctx, ev);
                else node = (ctx, ev) => left(ctx, ev) != right(ctx, ev);
            }
            return node;
        }

        function parseRelational() {
            let node = parseAdditive();
            const relOps = ['<', '>', '<=', '>='];
            while (relOps.includes(peek())) {
                const op = next();
                const right = parseRelational();
                const left = node;
                if (op === '<') node = (ctx, ev) => left(ctx, ev) < right(ctx, ev);
                else if (op === '>') node = (ctx, ev) => left(ctx, ev) > right(ctx, ev);
                else if (op === '<=') node = (ctx, ev) => left(ctx, ev) <= right(ctx, ev);
                else if (op === '>=') node = (ctx, ev) => left(ctx, ev) >= right(ctx, ev);
            }
            return node;
        }

        function parseAdditive() {
            let node = parseMultiplicative();
            while (peek() === '+' || peek() === '-') {
                const op = next();
                const right = parseMultiplicative();
                const left = node;
                if (op === '+') node = (ctx, ev) => left(ctx, ev) + right(ctx, ev);
                else node = (ctx, ev) => left(ctx, ev) - right(ctx, ev);
            }
            return node;
        }

        function parseMultiplicative() {
            let node = parseUnary();
            while (peek() === '*' || peek() === '/' || peek() === '%') {
                const op = next();
                const right = parseUnary();
                const left = node;
                if (op === '*') node = (ctx, ev) => left(ctx, ev) * right(ctx, ev);
                else if (op === '/') node = (ctx, ev) => left(ctx, ev) / right(ctx, ev);
                else node = (ctx, ev) => left(ctx, ev) % right(ctx, ev);
            }
            return node;
        }

        function parseUnary() {
            const op = peek();
            if (op === '!' || op === '-' || op === '+') {
                next();
                const right = parseUnary();
                if (op === '!') return (ctx, ev) => !right(ctx, ev);
                if (op === '-') return (ctx, ev) => -right(ctx, ev);
                if (op === '+') return (ctx, ev) => +right(ctx, ev);
            }
            return parseMember();
        }

        function parseMember() {
            let node = parsePrimary();
            while (true) {
                const op = peek();
                if (op === '.') {
                    next();
                    const prop = next();
                    const objFn = node;
                    node = (ctx, ev) => {
                        const obj = unwrap(objFn(ctx, ev));
                        return obj?.[prop];
                    };
                } else if (op === '[') {
                    next();
                    const keyFn = parseTernary();
                    consume(']');
                    const objFn = node;
                    node = (ctx, ev) => {
                        const obj = unwrap(objFn(ctx, ev));
                        const key = unwrap(keyFn(ctx, ev));
                        return obj?.[key];
                    };
                } else if (op === '(') {
                    next();
                    const argFns = [];
                    if (peek() !== ')') {
                        while (true) {
                            argFns.push(parseTernary());
                            if (peek() === ')') break;
                            consume(',');
                        }
                    }
                    consume(')');
                    const fnGetter = node;
                    node = (ctx, ev) => {
                        const fn = fnGetter(ctx, ev);
                        const args = argFns.map(f => unwrap(f(ctx, ev)));
                        if (typeof fn === 'function') return fn(...args);
                        return undefined;
                    };
                } else break;
            }
            return node;
        }

        function parsePrimary() {
            const t = next();
            if (!t) return () => undefined;
            if (t === '(') {
                const node = parseTernary();
                consume(')');
                return node;
            }
            if (t === '{') {
                const entries = [];
                if (peek() !== '}') {
                    while (true) {
                        let key;
                        const kt = next();
                        if (kt.startsWith('"') || kt.startsWith("'")) key = kt.slice(1, -1);
                        else key = kt;
                        consume(':');
                        const valFn = parseTernary();
                        entries.push({ key, valFn });
                        if (peek() === '}') break;
                        consume(',');
                    }
                }
                consume('}');
                return (ctx, ev) => {
                    const obj = {};
                    for (const { key, valFn } of entries) obj[key] = unwrap(valFn(ctx, ev));
                    return obj;
                };
            }
            if (t === '[') {
                const itemFns = [];
                if (peek() !== ']') {
                    while (true) {
                        itemFns.push(parseTernary());
                        if (peek() === ']') break;
                        consume(',');
                    }
                }
                consume(']');
                return (ctx, ev) => itemFns.map(f => unwrap(f(ctx, ev)));
            }
            if (t.startsWith('"') || t.startsWith("'")) return () => t.slice(1, -1).replace(/\\(.)/g, '$1');
            if (/\d/.test(t)) return () => Number(t);
            if (t === 'true') return () => true;
            if (t === 'false') return () => false;
            if (t === 'null') return () => null;

            // Handle =/ state reference sigil
            if (t === '=/') {
                let path = '';
                // Consume path tokens after =/
                while (true) {
                    const p = peek();
                    if (p && /^[\w$]/.test(p)) {
                        path += next();
                    } else if (p === '/') {
                        const nextTok = peek(1);
                        if (nextTok && /^[\w$]/.test(nextTok)) {
                            path += next(); // eat /
                            path += next(); // eat identifier
                        } else {
                            break;
                        }
                    } else {
                        break;
                    }
                }
                return createPathFunction(path, 'state');
            }

            // Handle $this and $event
            if (t === '$this' || t === '$event') {
                let path = t;
                // Check for property access
                while (true) {
                    const p = peek();
                    if (p && /^[\w$]/.test(p)) {
                        path += next();
                    } else if (p === '/') {
                        const nextTok = peek(1);
                        if (nextTok && /^[\w$]/.test(nextTok)) {
                            path += next(); // eat /
                            path += next(); // eat identifier
                        } else {
                            break;
                        }
                    } else {
                        break;
                    }
                }
                if (path === '$this') return (ctx) => ctx;
                if (path === '$event') return (ctx, ev) => ev;
                if (path.startsWith('$this.') || path.startsWith('$this/')) return createPathFunction(path.slice(6), '$this');
                if (path.startsWith('$event.') || path.startsWith('$event/')) return createPathFunction(path.slice(7), '$event');
            }

            // Handle $.propertyName (macro argument reference)
            if (t === '$') {
                const p = peek();
                if (p === '.') {
                    next(); // consume '.'
                    let path = '';
                    while (true) {
                        const tok = peek();
                        if (tok && /^[\w$]/.test(tok)) {
                            path += next();
                        } else if (tok === '.' || tok === '/') {
                            const nextTok = peek(1);
                            if (nextTok && /^[\w$]/.test(nextTok)) {
                                path += next(); // eat . or /
                                path += next(); // eat identifier
                            } else {
                                break;
                            }
                        } else {
                            break;
                        }
                    }
                    return createPathFunction(path, '$macro');
                }
            }

            // Bareword: helper or error
            return (ctx, ev) => {
                const val = findInScope(ctx, t) || getHelper(t);
                if (val === undefined && !['_', '$'].includes(t)) {
                    suspendSubscriber(t, currentSubscriber);
                }
                return val;
            };
        }

        function unwrap(val) {
            if (val && typeof val === 'object' && 'value' in val) return val.value;
            return val;
        }

        try {
            return parseTernary();
        } catch (e) {
            console.error(`[cDOM] Parse Error in "${text}":`, e);
            return () => `[Parse Error]`;
        }
    }

    const parseLiteral = (text) => {
        const fn = createExpression(text);
        return fn();
    };

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
        const storage = getStorage(options.storage);
        const schema = options.schema;
        const transform = options.transform;

        const applyTransform = (v) => {
            if (!transform) return v;
            const fn = typeof transform === 'function' ? transform : getHelper(transform, options.unsafe);
            return fn ? fn(v) : v;
        };

        let value = applyTransform(val);

        if (name && storage) {
            const stored = storage.getItem(name);
            if (stored !== null) {
                try {
                    const parsed = JSON.parse(stored);
                    value = applyTransform(parsed);
                } catch (e) { /* ignore */ }
            }
        }
        if (schema) validate(value, schema);

        const s = {
            get value() {
                if (name && storage) {
                    const stored = storage.getItem(name);
                    if (stored !== null) {
                        try {
                            const parsed = JSON.parse(stored);
                            const transformed = applyTransform(parsed);
                            if (transformed !== value) {
                                value = transformed;
                                if (schema) validate(value, schema);
                            }
                        } catch (e) { /* ignore */ }
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

    signal.get = function (name, options = {}) {
        if (registry.has(name)) return registry.get(name);
        const val = options.defaultValue !== undefined ? options.defaultValue : null;
        return signal(val, { ...options, name });
    };

    function state(val, options = {}) {
        const name = options.name;
        const storage = getStorage(options.storage);
        const schema = options.schema;
        const transform = options.transform;

        const applyTransform = (v) => {
            if (!transform) return v;
            const fn = typeof transform === 'function' ? transform : getHelper(transform);
            return fn ? fn(v) : v;
        };

        let result;

        if (typeof val !== 'object' || val === null) {
            let value = applyTransform(val);
            if (name && storage) {
                const stored = storage.getItem(name);
                if (stored !== null) {
                    try {
                        const parsed = JSON.parse(stored);
                        value = applyTransform(parsed);
                    } catch (e) { /* ignore */ }
                }
            }
            if (schema) validate(value, schema);

            if (name && storage) {
                result = {
                    get value() {
                        const stored = storage.getItem(name);
                        if (stored !== null) {
                            try {
                                const parsed = JSON.parse(stored);
                                const transformed = applyTransform(parsed);
                                if (transformed !== value) {
                                    value = transformed;
                                    if (schema) validate(value, schema);
                                }
                            } catch (e) { /* ignore */ }
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
            const makeReactive = (target, path = [], rootObj = target) => {
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
                if (path.length === 0 && schema) validate(target, schema);

                return new Proxy(target, {
                    get(t, prop) {
                        if (typeof prop !== 'string' || prop === 'constructor' || prop === 'toJSON') return t[prop];
                        if (prop === '_lv_is_proxy') return true;

                        if (currentSubscriber) {
                            registerDependency(name);
                        }

                        const currentVal = t[prop];
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

    state.get = function (name, options = {}) {
        if (registry.has(name)) return registry.get(name);
        const val = options.defaultValue !== undefined ? options.defaultValue : null;
        return state(val, { ...options, name });
    };

    const session = (val, options = {}) => state(val, { ...options, storage: globalThis.sessionStorage });
    session.get = function (name, options = {}) {
        if (registry.has(name)) return registry.get(name);
        const val = options.defaultValue !== undefined ? options.defaultValue : null;
        return state(val, { ...options, name, storage: globalThis.sessionStorage });
    };

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
            if (!newNode) newNode = document.createTextNode('');
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

    // Legacy expression helpers removed in favor of structural reactivity


    // Transformation Helpers
    helpers.set('Integer', v => parseInt(v));
    helpers.set('Number', v => Number(v));
    helpers.set('String', v => String(v));
    helpers.set('Boolean', v => !!v);
    helpers.set('signal', signal);
    helpers.set('state', state);
    helpers.set('session', session);
    helpers.set('signal.get', signal.get);
    helpers.set('state.get', state.get);
    helpers.set('session.get', session.get);

    // Macro helper - creates reusable JSON templates
    helpers.set('macro', function (definition) {
        const { name, schema: macroSchema, body } = definition;
        if (!name || !body) {
            console.error('[cDOM] Macro definition requires "name" and "body"');
            return;
        }

        // Register the macro as a new helper
        const macroFn = function (input) {
            // Note: input is already resolved by evaluateStructural
            // Validate input if schema is provided
            if (macroSchema) {
                try {
                    validate(input, macroSchema);
                } catch (e) {
                    console.error(`[cDOM] Macro "${name}" validation error:`, e);
                    throw e;
                }
            }

            // Evaluate the body with macro context
            return evaluateMacroBody(body, this, null, input);
        };

        // Mark this as a macro so evaluateStructural knows to resolve the object first
        macroFn.isMacro = true;

        helpers.set(name, macroFn);
        return `[Macro ${name} registered]`;
    });

    // Mark macro helper to skip object resolution - it needs the raw definition
    helpers.get('macro').skipObjectResolution = true;

    // Helper function to evaluate macro body with $ context
    function evaluateMacroBody(body, context, event, macroContext) {
        // Store the current macro context on the element
        // This persists so async helper loading can still access it
        context._macroContext = macroContext;
        return evaluateStructural(body, context, event, false);
    }


    function getHelper(name, unsafe) {
        if (helpers.has(name)) return helpers.get(name);

        const isUnsafe = unsafe || currentSubscriber?.unsafe;
        if (isUnsafe) {
            const parts = name.split('.');
            let obj = globalThis;
            for (let i = 0; i < parts.length; i++) {
                obj = obj?.[parts[i]];
            }
            if (typeof obj === 'function') {
                helpers.set(name, obj);
                return obj;
            }
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


    function evaluateStructural(obj, context, event, unsafe) {
        if (typeof obj !== 'object' || obj === null || obj.nodeType) {
            // Check if it's a string starting with '$.' (macro argument reference)
            if (typeof obj === 'string' && obj.startsWith('$.')) {
                return evaluateStateExpression(obj, context, event);
            }
            return obj;
        }
        obj = unwrap(obj);

        if (Array.isArray(obj)) {
            return obj.map(item => evaluateStructural(item, context, event, unsafe));
        }

        const keys = Object.keys(obj);
        const key = keys[0];
        if (!key) return obj;
        const val = obj[key];

        // 1. XPath / CSS
        if (key === '$') {
            if (currentSubscriber) {
                currentSubscriber.structural = obj;
                domListeners.add(currentSubscriber);
            }
            return evaluateExpression(val, context, false, '$', event).value;
        }

        // 2. State lookup or Math expression
        if (key === '=') {
            return evaluateStateExpression(val, context, event);
        }

        // 3. Helper call / Operator
        const alias = symbolicOperators.get(key);
        if (key.startsWith('=') || alias) {
            const helperName = alias || key.slice(1);
            const helperFn = getHelper(helperName, unsafe);
            if (helperFn) {
                // If val is an object (not array), treat as single named-argument object
                // UNLESS the helper has skipObjectResolution flag (like macro)
                if (!Array.isArray(val) && typeof val === 'object' && val !== null) {
                    // If helper wants raw object, pass it directly
                    if (helperFn.skipObjectResolution) {
                        return helperFn.call(context, val);
                    }

                    // Otherwise resolve the object properties
                    const resolvedObj = {};
                    for (const k of Object.keys(val)) {
                        const v = val[k];
                        const isPath = typeof v === 'string' && (
                            v.startsWith('=/') ||
                            v.startsWith('$.') ||
                            v === '$this' || v.startsWith('$this/') || v.startsWith('$this.') ||
                            v === '$event' || v.startsWith('$event/') || v.startsWith('$event.')
                        );

                        if (isPath) {
                            resolvedObj[k] = unwrap(evaluateStateExpression(v, context, event));
                        } else if (typeof v === 'object' && v !== null && !v.nodeType) {
                            resolvedObj[k] = evaluateStructural(v, context, event, unsafe);
                        } else {
                            resolvedObj[k] = v;
                        }
                    }
                    return helperFn.call(context, resolvedObj);
                }

                // Otherwise, treat as array of positional arguments
                const args = Array.isArray(val) ? val : [val];
                const resolvedArgs = args.map(arg => {
                    const isPath = typeof arg === 'string' && (
                        arg.startsWith('=/') ||
                        arg.startsWith('$.') ||
                        arg === '$this' || arg.startsWith('$this/') || arg.startsWith('$this.') ||
                        arg === '$event' || arg.startsWith('$event/') || arg.startsWith('$event.')
                    );

                    if (isPath) {
                        const mutationOperators = ['++', '--', 'increment', 'decrement'];
                        if (mutationOperators.includes(key) || mutationOperators.includes(helperName) || helperFn.mutates) {
                            const p = arg === '$this' ? '$this' : (arg === '$event' ? '$event' : (arg.startsWith('=/') ? 'state' : null));
                            if (p) {
                                let path = arg;
                                if (p === 'state') path = arg.slice(2); // Remove =/ prefix
                                return createPathFunction(path, p)(context, event, context._macroContext);
                            }
                        }
                        return unwrap(evaluateStateExpression(arg, context, event));
                    }
                    if (typeof arg === 'object' && arg !== null && !arg.nodeType) {
                        return evaluateStructural(arg, context, event, unsafe);
                    }
                    return arg;
                });
                return helperFn.apply(context, resolvedArgs);
            } else {
                suspendSubscriber(helperName, currentSubscriber);
                return `[Helper ${helperName} undefined]`;
            }
        }

        // 4. Plain object: Deeply resolve properties
        const result = {};
        for (const k of keys) {
            const v = obj[k];
            const isPath = typeof v === 'string' && (
                v === '$this' || v.startsWith('$this/') || v.startsWith('$this.') ||
                v === '$event' || v.startsWith('$event/') || v.startsWith('$event.') ||
                v.startsWith('=/')
            );

            if (isPath) {
                result[k] = evaluateStateExpression(v, context, event);
            } else if (typeof v === 'object' && v !== null && !v.nodeType) {
                result[k] = evaluateStructural(v, context, event, unsafe);
            } else {
                result[k] = v;
            }
        }
        return result;
    }

    cDOM.operator = (symbol, helperName) => {
        symbolicOperators.set(symbol, helperName);
    };

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
        const compiled = createExpression(expr);
        return (ctx, ev) => {
            try {
                return compiled(ctx, ev);
            } catch (e) {
                console.error(`[cDOM] Execution Error in "${expr}":`, e, { contextNode: ctx });
                return `_(${expr})`;
            }
        };
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
            else if (type === '$macro') root = ctx?._macroContext;
            else root = findInScope(ctx, name);

            if (!root) return (type === 'state') ? `[Unknown: ${name}]` : undefined;

            // For $macro, we access the property directly on the macro context
            if (type === '$macro') {
                if (parts.length === 0) return root;
                let target = root;
                for (const part of parts) {
                    if (target === undefined || target === null) return undefined;
                    target = target[part];
                }
                return target;
            }

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
        return []; // Legacy expressions disabled
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
            console.error(`[cDOM] CSS Error: "${selector}"`, e, { contextNode });
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
            console.error(`[cDOM] XPath Error: "${expression}"`, e, { contextNode });
            return { type: 'value', value: `[XPath Error: ${expression}]` };
        }
    }

    function notifyDOMChange() {
        for (const sub of domListeners) {
            if (!sub.node.isConnected && !(sub.node instanceof Attr && sub.node.ownerElement?.isConnected)) {
                domListeners.delete(sub);
                continue;
            }
            if (sub.structural) {
                currentSubscriber = sub;
                const result = evaluateStructural(sub.structural, sub.contextNode, null, sub.unsafe);
                currentSubscriber = null;
                const newValue = String(result ?? '');
                if (sub.node instanceof Attr) {
                    if (sub.node.ownerElement.getAttribute(sub.node.name) !== newValue) {
                        sub.node.ownerElement.setAttribute(sub.node.name, newValue);
                    }
                } else {
                    if (sub.node.nodeValue !== newValue) {
                        sub.node.nodeValue = newValue;
                    }
                }
            } else if (sub.attr) {
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
        onode = unwrap(onode);

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
            return document.createTextNode(onode);
        }

        if (Array.isArray(onode)) {
            const frag = document.createDocumentFragment();
            for (const node of onode) {
                const childNode = cdomToDOM(node, wasString, unsafe, context);
                if (childNode) frag.appendChild(childNode);
            }
            return frag;
        }

        if (onode.nodeType) return onode;

        const keys = Object.keys(onode);
        if (keys.length === 1 && (keys[0] === '=' || keys[0] === '$' || keys[0].startsWith('=') || symbolicOperators.has(keys[0]))) {
            const placeholder = document.createTextNode('');
            const sub = {
                node: placeholder,
                contextNode: context,
                fn: (event) => evaluateStructural(onode, context, event, unsafe),
                wasString,
                unsafe
            };
            placeholder._lv_sub = sub;
            currentSubscriber = sub;
            const result = sub.fn();
            currentSubscriber = null;

            if (result && typeof result === 'object' && !Array.isArray(result) && !result.nodeType) {
                if (Object.keys(result).length > 0) {
                    const dom = cdomToDOM(result, wasString, unsafe, context);
                    if (dom) {
                        sub.node = dom;
                        dom._lv_sub = sub;
                        return dom;
                    }
                }
            }
            placeholder.nodeValue = String(result ?? '');
            return placeholder;
        }

        const tag = keys[0];
        if (!tag) return document.createDocumentFragment();

        const content = onode[tag];
        const el = document.createElement(tag);
        if (context) Object.defineProperty(el, '_lv_parent', { value: context, enumerable: false, configurable: true });

        if (typeof content === 'object' && content !== null && !Array.isArray(content) && !content.nodeType) {
            for (const key in content) {
                const val = content[key];
                if (key === 'children') {
                    const children = Array.isArray(val) ? val : [val];
                    for (const child of children) {
                        const childNode = cdomToDOM(child, wasString, unsafe, el);
                        if (childNode) el.appendChild(childNode);
                    }
                } else if (key === 'class') {
                    el.className = val;
                } else if (key === 'style' && typeof val === 'object' && val !== null) {
                    for (const s in val) el.style[s] = val[s];
                } else if (key === 'oncreate' || key === 'onmount') {
                    if (typeof val === 'function') {
                        if (key === 'oncreate') try { val.call(el); } catch (e) { }
                        else el.onmount = val;
                    } else if (typeof val === 'object' && val !== null) {
                        if (key === 'oncreate') try { evaluateStructural(val, el, null, unsafe); } catch (e) { }
                        else el.onmount = () => evaluateStructural(val, el, null, unsafe);
                    }
                } else if (key.startsWith('on')) {
                    if (typeof val === 'function') {
                        el[key] = val;
                    } else if (typeof val === 'object' && val !== null) {
                        el[key] = (event) => evaluateStructural(val, el, event, unsafe);
                    }
                } else {
                    if (typeof val === 'object' && val !== null) {
                        const sub = { node: el, contextNode: el, fn: (event) => evaluateStructural(val, el, event, unsafe), unsafe };
                        currentSubscriber = sub;
                        const initial = sub.fn();
                        currentSubscriber = null;
                        el.setAttribute(key, String(initial ?? ''));
                    } else {
                        el.setAttribute(key, val);
                    }
                }
            }
        } else {
            const childNode = cdomToDOM(content, wasString, unsafe, el);
            if (childNode) el.appendChild(childNode);
        }

        return el;
    }

    // call with no options when using to simply construct a DOM element

    // call with options to insert into the DOM
    function cDOM(cdom, options, script = document.currentScript) {
        const type = typeof cdom;
        const wasString = type === 'string' || (options && options._wasString);
        let cdomObj = cdom;
        if (type === 'string') {
            cdomObj = JSON.parse(cdom);
        }

        if (options) {
            let { target = script, location = 'outerHTML' } = options;
            if (typeof target === 'string') {
                const targets = Array.from(document.querySelectorAll(target));
                let firstRes = null;
                for (let i = 0; i < targets.length; i++) {
                    const res = cDOM(cdomObj, { ...options, target: targets[i], _wasString: wasString }, script);
                    if (i === 0) firstRes = res;
                }
                return firstRes;
            }

            const dom = cdomToDOM(cdomObj, wasString, options.unsafe, options.context);
            location = (location || 'outerHTML').toLowerCase();
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
            return dom;
        }
        return cdomToDOM(cdomObj, wasString);
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
            const response = await globalThis.fetch(url.href);
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
            element.innerHTML = `<div style="color:red;">Failed to load: ${srcValue} ${e.message}</div>`;
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

    // Default Operator Mappings
    cDOM.operator('+', 'add');
    cDOM.operator('-', 'subtract');
    cDOM.operator('*', 'multiply');
    cDOM.operator('/', 'divide');
    cDOM.operator('==', 'eq');
    cDOM.operator('>', 'gt');
    cDOM.operator('<', 'lt');
    cDOM.operator('&&', 'and');
    cDOM.operator('||', 'or');
    cDOM.operator('!', 'not');
    cDOM.operator('++', 'increment');
    cDOM.operator('--', 'decrement');


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
    // Export to global scope
    cDOM.signal = signal;
    cDOM.state = state;
    cDOM.session = session;
    cDOM.helper = helper;
    cDOM.schema = schema;
    cDOM.validate = validate;
    cDOM._ = _;
    cDOM.$ = $;
    cDOM.script = document.currentScript;

    globalThis.cDOM = cDOM;
    globalThis._ = _;
    globalThis.$ = $;
})();
