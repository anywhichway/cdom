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
                    { p: ["Count: ", { "=": "=/counter/count" }] },
                    { button: { 
                        onclick: { "=increment": ["=/counter"] }, 
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
                { p: ["Current: ", { "=": "=/local/count" }] },
                // Structural event handler
                { button: { 
                     onclick: { "=increment": ["=/local"] }, 
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

cDOM v0.0.12+ uses **structural reactivity**. You express logic using JSON keys starting with `=`.

**State Lookup:**
```javascript
{ "=": "=/user/name" }  // State reference requires =/ prefix
```

**The `=/` Sigil:**
To avoid ambiguity between URL paths (like `/api/users`) and state paths, cDOM **requires** the `=/` prefix for all state references:

```javascript
// Literals (no =/ prefix) vs State references (=/ prefix required)
{ "=concat": ["/api/space/", "=/currentSpace", "/participants.cdom"] }

// In expressions
{ "=": "=/count * 2" }           // State reference in expression
{ "=": "10 / =/count" }          // Division by state value
{ "=": "=/price * =/quantity" }  // Multiple state refs
```

**Helper Calls:**
Complex logic uses the key as the helper name:
```javascript
{ "=increment": ["=/counter"] } // Calls 'increment' helper with state reference
```

**Direct Operators:**
You can use mathematical and logical operators directly as keys:
```javascript
{ "*": ["=/price", "=/qty"] }
{ ">=": ["=/age", 18] }
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

You can store named session or state objects in Storage objects (e.g. `sessionStorage` or `localStorage`) for persistence. It will be saved any time there is a change. Objects are automatically serialized to JSON and deserialized back to objects.

Both objects and strings are supported for the `storage` value (e.g., `localStorage` or `"localStorage"`).

```javascript
// cDOM.session is a shortcut for state with sessionStorage
const user = session({name:'Guest', theme:'dark'}, {name:'user'});

// Retrieve it elsewhere (even in another file)
const sameUser = session.get('user');

// Get or create with default value
const score = session.get('user', {
    defaultValue: { name: 'Guest', theme: 'dark' }
});
```

#### How Storage Persistence Works

**Important:** Storage (localStorage/sessionStorage) is used **for persistence only**, not as a reactive data source.

- **On initialization**: State is loaded from storage if it exists
- **On updates**: Changes to the state proxy automatically write to storage AND trigger reactive updates
- **On reads**: Values are read from the in-memory reactive proxy (not from storage)

**The in-memory state proxy is the source of truth for reactivity.** Storage is only used to persist state across page reloads.

⚠️ **This means:**
- Updating storage directly via `localStorage.setItem()` will **NOT** trigger UI updates
- Updating storage via browser dev tools will **NOT** trigger UI updates
- Changes will only be reflected after a page reload or when the state is re-initialized

**To trigger reactive updates, always modify the state object itself:**

```javascript
// ✅ CORRECT - Triggers reactivity
const user = state.get('user');
user.name = 'Alice';  // Updates in-memory state, writes to storage, triggers UI update

// ❌ WRONG - Does NOT trigger reactivity
localStorage.setItem('user', JSON.stringify({ name: 'Alice' }));  // Only updates storage
```

### 8. Transformations

Automatically cast incoming values or sync with storage. Built-in transforms include: `Integer`, `Number`, `String`, `Boolean`.

```javascript
cDOM.signal(0, { 
    name: 'count', 
    transform: 'Integer' 
});
```

### 9. Macros

Macros allow you to define reusable logic templates entirely in JSON, without writing JavaScript. They are perfect for domain-specific calculations, complex formulas, or frequently-used patterns.

#### Defining a Macro

```json
{
  "=macro": {
    "name": "adjusted_price",
    "schema": {
      "type": "object",
      "required": ["basePrice", "taxRate"],
      "properties": {
        "basePrice": { "type": "number", "minimum": 0 },
        "taxRate": { "type": "number", "minimum": 0, "maximum": 1 },
        "discount": { "type": "number", "minimum": 0, "maximum": 1 }
      }
    },
    "body": {
      "*": [
        "$.basePrice",
        { "+": [1, "$.taxRate"] },
        { "-": [1, "$.discount"] }
      ]
    }
  }
}
```

**Fields:**
- **`name`**: The macro identifier (becomes a callable helper)
- **`schema`** (optional): JSON Schema for input validation
- **`body`**: The template structure using `$.propertyName` to reference inputs

#### Calling a Macro

Macros are called like any helper, but always with an object argument:

```json
{
  "=adjusted_price": {
    "basePrice": 100,
    "taxRate": 0.08,
    "discount": 0.10
  }
}
```

Result: `97.2` (100 × 1.08 × 0.90)

#### Using State in Macros

```json
{
  "=adjusted_price": {
    "basePrice": "=/product/price",
    "taxRate": "=/settings/tax",
    "discount": 0.10
  }
}
```

### 10. Object-Based Helper Arguments

Helpers can now accept either **positional arguments** (array) or **named arguments** (object):

**Positional (traditional):**
```json
{ "=sum": [1, 2, 3] }
```

**Named (new):**
```json
{
  "=webservice": {
    "url": "/api/users",
    "method": "POST",
    "body": "=/formData"
  }
}
```

When an object is passed, it's treated as a single argument. To pass an array as a single argument, wrap it: `[[1, 2, 3]]`.


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
