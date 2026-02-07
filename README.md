# cDOM - Computational DOM

> **⚠️ EXPERIMENTAL**: cDOM is currently in version v0.0.10. The syntax and API are rapidly evolving and may change without notice. Use with caution.

**A reactive UI library with hypermedia capabilities with modified JPRX support (reactive JSON Pointers and XPath) plus JSON Schema validation and state persistence.**

cDOM is a reactive framework that lets you build dynamic UIs using declarative object notation. Uniquely, cDOM uses **structural reactivity**, where logic is defined via JSON structure rather than string parsing.

## Features

- 🎯 **Reactive State Management** - Signals and state with automatic dependency tracking
- 🔄 **Declarative UI** - Build interfaces using simple JavaScript objects
- 🧱 **Structural Reactivity** - Define complex logic using nested objects `{ "=": ... }`
- 🛡️ **Schema Validation** - Built-in JSON Schema validation for robust state
- 💾 **Persistence** - Automatic sync to `localStorage` or `sessionStorage`
- 🌐 **Hypermedia Support** - `src` and `href` attributes for dynamic content loading
- 📊 **XPath & CSS Queries** - Navigate and query the DOM with reactive `{ "$": ... }` expressions
- 🧮 **Direct Operator Support** - Use operators like `*`, `+`, `>=` directly in your structure
- 🪶 **Lightweight** - ~15KB minified, ZERO dependencies
- 🔌 **Standalone** - Works independently of Lightview

## Installation

### CDN (Recommended)

```html
<script src="https://cdn.jsdelivr.net/npm/cdom/index.min.js"></script>
```

### Local

Download `cdom.js` and include it in your project:

```html
<script src="path/to/cdom.js"></script>
```


## Quick Start

### Standard Usage

```html
<html>
<script src="https://cdn.jsdelivr.net/npm/cdom/index.min.js"></script>

<body>
    <script>
        // Register helper
        cDOM.helper('increment', (s) => { if(s && typeof s.count === 'number') s.count++; return s.count; });

        // Create a simple counter
        cDOM({
            div: {
                oncreate: {
                     "=state": [{ count: 0 }, { name: 'counter', scope: "$this" }]
                },
                children: [
                    { h2: "Counter Example" },
                    { p: ["Count: ", { "=": "/counter/count" }] },
                    { button: { 
                        onclick: { "=increment": ["/counter"] }, 
                        children: ["Increment"] 
                    }}
                ]
            }
        }, { target: document.body, location: 'beforeend' });
    </script>
</body>
</html>
```

### Component Functions

Create reusable components as functions.

```javascript
function Counter(initialValue = 0) {
    return {
        div: {
            class: "counter-widget",
            // Use structural object for initialization
            oncreate: {
                 "=state": [{ count: initialValue }, { name: 'local', scope: "$this" }]
            },
            children: [
                { h3: "Counter" },
                { p: ["Current: ", { "=": "/local/count" }] },
                // Structural event handler
                { button: { 
                     onclick: { "=increment": ["/local"] }, 
                     children: ["+"] 
                }}
            ]
        }
    };
}

cDOM({
    div: [
        { h1: "My App" },
        Counter(0)
    ]
}, {});
```

## Core Concepts

### 1. Structural Reactivity (The `=` Key)

cDOM v0.0.10 moves away from complex string parsing (`_()`) in favor of **structural reactivity**. You express logic using JSON keys starting with `=`.

**State Lookup:**
```javascript
{ "=": "/user/name" } // Resolves to state value
```

**Math Expressions:**
For simple math, you can still use string expressions inside the value:
```javascript
{ "=": "/price * /quantity" }
```

**Helper Calls:**
Complex logic uses the key as the helper name:
```javascript
{ "=increment": ["/counter"] } // Calls 'increment' helper with resolving args
```

**Direct Operators:**
You can use mathematical and logical operators directly as keys:
```javascript
{ "*": ["/price", "/qty"] }
{ ">=": ["/age", 18] }
```

### 3. Sequential Actions (Array Handlers)

Event handlers (`onclick`, `onmount`, `onchange`, etc.) can accept an **Array** of structural expressions. Each expression in the array will be executed sequentially. This is useful for performing multiple side-effects in a single interaction.

```javascript
{
    button: {
        onclick: [
            { "set": ["/ui/loading", true] },
            { "=analytics.track": ["save_clicked"] }, // Resolves via global path (window.analytics.track)
            { "=saveData": "/form" },
            { "set": ["/ui/status", "Saved!"] },
            { "set": ["/ui/loading", false] }
        ],
        children: ["Save Now"]
    }
}
```

### 4. DOM Queries (The `$` Key)

Query the DOM using XPath or CSS selectors via the `$` key.

**Structural Usage (Reactive):**
When used as a key in a cDOM object, queries are reactive to DOM changes using a `MutationObserver`. They will automatically update when nodes are added, removed, or attributes change.

```javascript
// XPath - Count buttons (updates automatically on DOM change)
{ "$": "count(//button)" }

// CSS - Get value
{ "$": "#myInput" }
```

**Functional Usage (Non-Reactive to DOM):**
When used inside an expression string or directly in JavaScript, the query is a one-time evaluation. It will not re-run when the DOM changes, unless the surrounding expression is triggered by a state change.

```javascript
// This counts buttons once, or when a state dependency triggers a re-eval
{ "=": "count($('//button')) + 1" }
```

> **Design Note: Why aren't all queries live?**
> While making every `$(...)` call live would be convenient, it carries significant performance overhead. Structural reactivity (`{ "$": ... }`) allows the engine to explicitly track which elements are watching the DOM, preventing "mutation storms" and infinite loops while ensuring efficient memory cleanup.


### 5. Signals and State

#### Initialization

Use the `state` helper in `oncreate`:

```javascript
oncreate: {
  "=state": [
    { user: 'Alice' }, 
    { name: 'currentUser' } 
  ]
}
```

#### Scoped State

Scope state to a specific component using the `$this` keyword in the options:

```javascript
oncreate: {
  "=state": [
    { count: 0 }, 
    { name: 'counter', scope: "$this" } 
  ]
}
```

### 6. Schema Validation

cDOM supports JSON Schema validation to ensure your state remains consistent.

```javascript
// Register a named schema
cDOM.schema('User', {
    type: 'object',
    required: ['name', 'age'],
    properties: {
        name: { type: 'string', minLength: 2 },
        age: { type: 'integer', minimum: 0 }
    }
});

// Apply to state
oncreate: {
    "=state": [
        { name: 'Bob', age: 25 }, 
        { name: 'user', schema: 'User' }
    ]
}
```

### 7. Persistence

Sync your signals and state automatically to `localStorage` or `sessionStorage`.

```javascript
// Retrieve on every access, update on every change
oncreate: {
    "=signal": [
        'light', 
        { name: 'site-theme', storage: localStorage }
    ]
}
```

### 8. Persistence & Transformations

Automatically cast incoming values or sync with storage.

```javascript
cDOM.signal(0, { 
    name: 'count', 
    transform: 'Integer' // Built-in: Integer, Number, String, Boolean
});
```

## Supported Operators and Helpers

### Operators (Structural Keys)

These can be used directly as keys in your cDOM structure (e.g., `{ "+": [1, 2] }`).

*   **Math:** `+`, `-`, `*`, `/`, `%`
*   **Comparison:** `==`, `!=`, `>`, `<`, `>=`, `<=`
*   **Logic:** `&&`, `||`, `!` (unary)
*   **Mutation:** `++`, `--`
*   **Ternary:** `?`, `:`

### Built-in Helpers

Helpers are dynamically loaded if not already registered. You can use them structurally (e.g., `{ "=sum": [1, 2] }`) or within expression strings.

#### Dynamic Loading
If a helper is used but not registered via `cDOM.helper()`, the engine attempts to load it dynamically.
1. It checks for the function in the `globalThis` scope (e.g., `Math.abs`), but **only if the `unsafe` option is enabled** in the `cDOM()` call.
2. If the function is not found or `unsafe` is false, it attempts to fetch a JavaScript file from the `/helpers/` directory relative to the `index.js` script.
   - For example, `{ "=currency": [...] }` will attempt to load `/helpers/currency.js`.
   - Nested namespaces like `Formatting.Currency` will attempt to load `/helpers/formatting/currency.js`.

The dynamic loader uses the `default` export of the imported module as the helper function.

#### Math & Statistics
`abs`, `add`, `average`, `avg`, `ceil`, `ceiling`, `floor`, `int`, `max`, `median`, `min`, `mod`, `multiply`, `percent`, `pow`, `power`, `rand`, `random`, `round`, `sign`, `sqrt`, `stddev`, `stdev`, `subtract`, `sum`, `trunc`, `var`, `variance`

#### Logic & Flow
`and`, `or`, `not`, `if`, `ifs`, `switch`, `choose`, `coalesce`, `iferror`

#### String Manipulation
`concat`, `join`, `split`, `trim`, `upper`, `lower`, `proper`, `titlecase`, `tocamelcase`, `toslugcase`, `left`, `right`, `mid`, `len`, `length`, `slice`, `substring`, `replace`, `substitute`, `padend`, `padstart`, `startswith`, `endswith`, `includes`, `charat`, `text`, `textjoin`, `fixed`

#### Array & Object
`count`, `map`, `filter`, `reduce`, `every`, `some`, `find`, `findindex`, `sort`, `reverse`, `push`, `pop`, `first`, `last`, `unique`, `flat`, `keys`, `object`, `isarray`, `xlookup`

#### Type Checking
`isnumber`, `isstring`, `istext`, `isblank`, `isempty`, `isarray`

#### Date & Time
`now`, `today`, `day`, `month`, `year`, `weekday`, `datedif`

#### Formatting
`currency`, `tofixed`, `tolocalestring`

#### State Mutation
`set`, `assign`, `increment`, `decrement`, `clear`, `toggle`

#### Network
`fetch`, `webservice`

### Defining Custom Helpers

You can register custom helpers using `cDOM.helper(name, fn)`. 

#### Mutation Helpers
If a helper is designed to mutate state data (rather than just calculating a value), you **must** set the `.mutates = true` property on the function. This informs the cDOM parser to pass the underlying state reference (wrapper) rather than the unwrapped value, allowing the helper to perform the update.

**Example: Custom Increment**
```javascript
const increment = function (target, by = 1) {
    // target here is a state wrapper with a .value property
    const current = (target && typeof target === 'object' && 'value' in target) ? target.value : 0;
    target.value = Number(current) + Number(by);
    return target.value;
}

// CRITICAL: Must flag as mutation for the parser to pass the state reference
increment.mutates = true;

cDOM.helper('myIncrement', increment);
```

Usage in cDOM:
```javascript
{ button: { 
    onclick: { "=myIncrement": ["/counter/count", 5] }, 
    children: ["+5"] 
}}
```

## API Reference

### `cDOM(object, options?)`

Converts cDOM object to DOM.

**Options:**
*   `target`: Element or CSS selector.
*   `location`: Insertion position (`innerHTML`, `beforeend`, etc.).
*   `unsafe`: Allow unsafe eval (default: `false`).

### `cDOM.operator(symbol, helperName)`

Map a custom symbol to a helper function.

```javascript
// Map '^' to 'pow' helper
cDOM.operator('^', 'pow'); 

// Use in HTML structure
{ "^": [2, 3] } // Returns 8
```

## Browser Support

- Modern browsers with ES6+ support
- Requires `MutationObserver`, `Proxy`, and `XPath` APIs
- IE11 not supported

## License

MIT
