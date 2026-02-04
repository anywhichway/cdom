# cDOM - Computational DOM

**A reactive UI library with hypermedia capabilities with JPRX support (reactive JSON Pointers and XPath) plus JSON Schema validation and state persistence.**

cDOM is a reactive framework that lets you build dynamic UIs using declarative object notation. Originally based on [Lightview](https://github.com/anywhichway/lightview), cDOM provides a focused subset of features for developers who want reactivity and hypermedia without the full framework.

## Features

- 🎯 **Reactive State Management** - Signals and state with automatic dependency tracking
- 🔄 **Declarative UI** - Build interfaces using simple JavaScript objects
- 🛡️ **Schema Validation** - Built-in JSON Schema validation for robust state
- 💾 **Persistence** - Automatic sync to `localStorage` or `sessionStorage`
- 🌐 **Hypermedia Support** - `src` and `href` attributes for dynamic content loading
- 📊 **XPath & CSS Queries** - Navigate and query the DOM with reactive `$()` expressions
- 🧮 **Math Expressions** - Evaluate formulas with `_()` for reactive calculations
- 🪶 **Lightweight** - ~15KB minified, no dependencies except optional expr-eval
- 🔌 **Standalone** - Works independently of Lightview

## Installation

### CDN (Recommended)

```html
<!-- Optional: Math expression parser -->
<script src="https://unpkg.com/expr-eval@2.0.2/dist/bundle.min.js"></script>
<!-- cDOM library -->
<script src="https://unpkg.com/cdom/index.js"></script>
```

**Note:** `expr-eval` is optional. cDOM will function without it, but support for complex math expressions and reactive logic within `_()` and `set()` helper calls will be unavailable.

### Local

Download `cdom.js` and include it in your project:

```html
<script src="https://unpkg.com/expr-eval@2.0.2/dist/bundle.min.js"></script>
<script src="path/to/cdom.js"></script>
```

## Quick Start

### Standard Usage

```html
<html>
<script src="https://unpkg.com/expr-eval@2.0.2/dist/bundle.min.js"></script>
<script src="./cdom.js"></script>

<body>
    <script>
        // Create a simple counter
        cDOM({
            div: {
                oncreate: function() {
                    cDOM.state({ count: 0 }, { name: 'counter', scope: this });
                },
                children: [
                    { h2: "Counter Example" },
                    { p: ["Count: ", "_(/counter/count)"] },
                    { button: { 
                        onclick: "_(++/counter/count)", 
                        children: ["Increment"] 
                    }}
                ]
            }
        }, { target: document.body, location: 'beforeend' });
    </script>
</body>
</html>
```

### Inline Usage

cDOM will replace the script is runs in if an emty options object is provided, just put the script where you want the HTML.

```html
<html>
<script src="https://unpkg.com/expr-eval@2.0.2/dist/bundle.min.js"></script>
<script src="https://unpkg.com/cdom/index.js"></script>

<body>
    <script>
        // Create a simple counter
        cDOM({
            div: {
                oncreate: function() {
                    cDOM.state({ count: 0 }, { name: 'counter', scope: this });
                },
                children: [
                    { h2: "Counter Example" },
                    { p: ["Count: ", "_(/counter/count)"] },
                    { button: { 
                        onclick: "_(++/counter/count)", 
                        children: ["Increment"] 
                    }}
                ]
            }
        }, { });
    </script>
</body>
</html>
```

**Resulting DOM (as seen in DevTools):**

```html
<body>
    <div>
        <h2>Counter Example</h2>
        <p>Count: 0</p>
        <button onclick="_(++/counter/count)">Increment</button>
    </div>
</body>
```


### Component Functions

Create reusable components as functions. Components can either return a rendered DOM element by calling `cDOM()` internally (without options), or return a raw oDOM object to be processed by a parent container.

**Option A: Returning a rendered element**

```javascript
const { state } = cDOM;
function Counter(initialValue = 0) {
    // Calling cDOM() here returns a ready-to-use DOM element
    return cDOM({
        div: {
            class: "counter-widget",
            oncreate() {
                state({ count: initialValue }, { name: 'local', scope: this });
            },
            children: [
                { h3: "Counter" },
                { p: ["Current: ", "_(/local/count)"] },
                { button: { onclick: "_(++/local/count)", children: ["+"] }}
            ]
        }
    });
}
```

**Option B: Deferring to a wrapper (Returning oDOM)**

Alternatively, skip the `cDOM()` call to return a plain object. This is often cleaner for nesting components within larger structures.

```javascript
function Header(title) {
    return { h1: title }; // Return raw oDOM
}

cDOM({
    div: [
        Header("My App"),
        Counter(0) // Works with either pattern!
    ]
}, {});
```

## Core Concepts

### 1. Object DOM (oDOM) Syntax

cDOM uses a concise object notation where the key is the tag name.The property 'children' is used to define the children of the element. All other properties are attributes. As a shortcut, if the value of a property is a string, it will be used as the text content of the element.

```javascript
{
    div: {
        class: "container",
        children: [
            { h1: "Title" }, // shortcut for text content
            { p: { children: ["Paragraph text"] } }
        ]
    }
}
```

### 2. Signals and State

#### Creating Signals

```javascript
// Simple reactive value
const count = cDOM.signal(0, { name: 'count' });

// Update
count.value = 5;
```

#### Creating State

```javascript
// Global state
cDOM.state({ user: 'Alice' }, { name: 'currentUser' });

// Scoped state (component-local)
cDOM.state({ count: 0 }, { name: 'counter', scope: this });
```

### Accessing Named Signals or State in Expressions

```javascript
// Absolute path (looks in global registry only)
"_(/currentUser/user)"

// Scoped path (searches current element, then bubbles up the DOM tree)
"_(counter/count)" 
// OR
"_(./counter/count)"

// With math
"_(/price * /quantity + /shipping)"

// Note: Explicit parent navigation `..` is NOT supported.
// Ambiguity prevents distinguishing between "parent object data" and "parent DOM element data".
// cDOM automatically bubbles up to find the nearest matching state name, so `..` is unnecessary.
// Use unique state names to disambiguate if needed.
```

### 3. Schema Validation

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
const user = cDOM.state({ name: 'Bob', age: 25 }, { 
    name: 'user', 
    schema: 'User' 
});

user.age = -1; // Throws Validation Error
```

### 4. Persistence

Sync your signals and state automatically to `localStorage` or `sessionStorage`.

```javascript
// Retrieve on every access, update on every change
const theme = cDOM.signal('light', { 
    name: 'site-theme', 
    storage: localStorage 
});

// Works with complex objects too
const settings = cDOM.state({ zoom: 1 }, { 
    name: 'app-settings', 
    storage: sessionStorage 
});
```

### 5. Transformations

Automatically cast incoming values using transformation helpers.

```javascript
const count = cDOM.signal(0, { 
    name: 'count', 
    transform: 'Integer' // Built-in: Integer, Number, String, Boolean
});

count.value = "10"; // Automatically becomes 10 (Number)
```

### 2. Reactivity with Functions

### 3. Reactivity with `_()` Expressions

State paths use `_()` for reactive binding:

```javascript
// String syntax (parsed by cDOM)
"_(/user/name)"

// Function syntax (for use in JavaScript)
_('/user/name')  // Returns the expression string for lazy binding
```

This can be tranported as JSON:

```javascript
{"span": "_(/user/name)"}
```

This can't be transported as JSON:

```javascript
{span: _('/user/name')}
```

**Math expressions:**

Requires loading the expr-eval library.

```javascript
"_(/price * /quantity)"             // Reactive calculation (Global paths)
_('./local/price * 1.1')            // Scoped path (requires ./ prefix)
```

**Important:** In math expressions, you **MUST** use either `/` (absolute) or `./` (scoped) prefixes for all state paths. This disambiguates state paths from mathematical division operators.

Expressions are reactive, if the state they reference changes, the expression will be re-evaluated.

**Note: No Inline Text Interpolation**

In **Text Nodes**, expressions must be the *entire* content string. Granularity is enforced by using valid child arrays, **OR** by using string concatenation within the expression itself.

*   ❌ `"Hello _(/name)"` (Will render literally, ignoring the expression)
*   ✅ `["Hello ", "_(/name)"]` (Using child array - Recommended)
*   ✅ `"_( 'Hello ' + /name )"` (Using string concatenation in math expression)
*   ✅ `"_(concat('Hello ', /name))"` (Using concat helper)

In **Attributes**, inline interpolation *is* supported because attributes cannot be split into children:
*   ✅ `class="btn _(/isActive ? 'active' : '') text-lg"`
*   ✅ `href="/users/_(/id)/profile"`

### 4. DOM Queries with `$()` Expressions

Query the DOM using XPath or CSS selectors:

```javascript
// XPath
"$(count(//button))"              // Count all buttons
$(//div[@id='main']/@class)     // Get class of #main

// CSS (when not XPath)
"$(.active)"                      // Query by class
```

DOM queries are reactive, if the DOM changes, the query will be re-evaluated.

### 5. Lifecycle Hooks

- **`oncreate`**: Called when element is created (before DOM insertion)
- **`onmount`**: Called when element is added to the DOM

```javascript
{
    div: {
        oncreate() {
            // Initialize state here
            cDOM.state({ data: [] }, { name: 'myData', scope: this });
        },
        onmount() {
            // DOM is ready, can access this element
            console.log('Mounted:', this);
        }
    }
}
```

## Hypermedia Features

### The `src` Attribute

Load content dynamically into any element:

```html
<!-- Load from CSS selector -->
<div src="#template"></div>

<!-- Load HTML file -->
<div src="/components/header.html"></div>

<!-- Load cDOM JSON -->
<div src="/data/widget.cdom"></div>

<!-- Load any text (displays in <pre>) -->
<div src="/data/config.json"></div>
```

**Important:** For non-standard elements (anything other than `<img>`, `<script>`, etc.), src paths **MUST** start with `./`, `../`, or `/`. This ensures they are correctly identified as URLs and not CSS selectors.

**Supported content types:**
- `.cdom` / `application/cdom` → Parsed as cDOM JSON
- `.html` / `text/html` → Inserted as HTML
- Everything else → Displayed in `<pre>` tag

### The `href` Attribute (Non-`<a>` Elements)

Make any element clickable with navigation:

```html
<!-- Load content on click -->
<button href="/api/data" target="#results">Load Data</button>

<!-- Hash scrolling -->
<button href="/docs.html#section-2">Jump to Section</button>
```

**Note:** Standard `<a>` tags always maintain their default browser behavior.


## Helpers

Register custom helper functions:

```javascript
const double = cDOM.helper('double',  (value) => value * 2);
const greet = cDOM.helper('greet', (name) => `Hello, ${name}!`);

// Use in expressions
"_(double(/count))"
"_(greet(/user/name))"
```

// use directly in functions
double(_('/user/name'))
```

When `_()` is used a string in a cDOM it establishes reatcive context and calls to wrapped helpers do not need to wrap state paths in nested `_()`. When a helper is called directly it does not establish a reactive context, but it know how to handle reactive arguments.

## Complete Example: Todo List

```html
<html>
<script src="https://unpkg.com/expr-eval@2.0.2/dist/bundle.min.js"></script>
<script src="./cdom.js"></script>

<body>
    <script>
        const { state } = cDOM;
        
        // Create global state
        const appState = state({ 
            todos: [],
            input: ''
        }, { name: 'app' });

        // Helper to add todo
        const addTodo = () => {
            if (!appState.input.trim()) return;
            appState.todos.push({ 
                text: appState.input, 
                done: false 
            });
            appState.input = '';
        });

        // Helper to toggle todo
        cDOM.helper('toggleTodo', (index) => {
            appState.todos[index].done = !appState.todos[index].done;
        });

        // Helper to remove todo
        cDOM.helper('removeTodo', (index) => {
            appState.todos.splice(index, 1);
        });

        cDOM({
            div: {
                class: "todo-app",
                children: [
                    { h1: "Todo List" },
                    { div: {
                        children: [
                            { input: { 
                                type: "text",
                                placeholder: "New todo...",
                                value: _('/app/input'),
                                oninput: "_(set(/app/input, $event.target.value))"
                            }},
                            { button: {
                                onclick() { addTodo() },
                                children: ["Add"]
                            }}
                        ]
                    }},
                    { ul: {
                        id: "todo-list",
                        children: _('/app/todos') // Reactive list rendering
                    }}
                ]
            }
        }, {});
    </script>
</body>
</html>
```

## API Reference

### `cDOM(object, options?)`

Converts cDOM object to DOM and optionally inserts it.

**Parameters:**
- `object`: cDOM object or JSON string
- `options`: Optional configuration
  - `target`: Element to insert into (default: `document.currentScript`)
  - `location`: Where to insert - `'innerHTML'`, `'outerHTML'`, `'beforeend'`, etc.
  - `unsafe`: Allow unsafe eval (default: `false`)

**Returns:** DOM element

If an options object is provided, the default location will be outerHTML on the current script, i.e. replace the script. If you do not want to replace anything and just want the reactive element, DO NOT pass in an options object.

### `cDOM.state(value, options)` / `cDOM.signal(value, options)`

Create reactive state or signals.

**Options:**
- `name`: String. Required for persistence or global lookup.
- `scope`: DOM element. Scope state to a specific tree (bubbles up).
- `storage`: `localStorage` or `sessionStorage` (or custom object).
- `schema`: String (named schema) or Object (inline schema).
- `transform`: String (helper name) or Function.

### `cDOM.helper(name, function)`

Register a helper function for use in expressions or transformations.

### `cDOM.schema(name, definition)`

Register a JSON Schema for state validation.

### `_(expression, contextNode?)`

Evaluate state expression.

**Parameters:**
- `expression`: State path or expression
- `contextNode`: Optional context element (omit for lazy binding)

### `$(expression, contextNode?)`

Evaluate DOM query (XPath or CSS).

**Parameters:**
- `expression`: XPath or CSS selector
- `contextNode`: Optional context element (omit for lazy binding)

## Expression Syntax

### State Expressions `_()`

```javascript
"_(/path/to/value)"           // Simple path
"_(/a + /b)"                  // Math
"_(/price * 1.1)"             // With literal
"_(helper(/arg1, /arg2))"     // Helper function
```

### DOM Queries `$()`

```javascript
// XPath
"$(//button)"                 // All buttons
"$(count(//div))"             // Count divs
"$(../../@id)"                // Parent's parent id

// CSS
"$(.active)"                  // By class
"$(#main)"                    // By id
```

## Browser Support

- Modern browsers with ES6+ support
- Requires `MutationObserver`, `Proxy`, and `XPath` APIs
- IE11 not supported

## Performance

- Reactive updates are batched using `queueMicrotask`
- Expressions are cached after first parse
- DOM queries are evaluated on-demand
- Minimal overhead for static content

## Limitations

- No virtual DOM diffing (direct DOM manipulation)
- No component lifecycle beyond `oncreate`/`onmount`
- No built-in routing
- No server-side rendering

## cDOM is great for simple reactive UIs, but consider [Lightview](https://github.com/anywhichway/lightview) if you need:

- **Advanced routing** with middleware chains
- **Component system** with 40+ pre-built components
- **Template literals** in attributes (cDOM uses `${}` style in Lightview-X mode)
- **Deep integration** with CSS-in-JS and shadow DOM defaults

cDOM was extracted from Lightview to provide a lightweight alternative for developers who want reactivity without the full framework.

## License

MIT

## Contributing

Issues and pull requests welcome at the [Lightview repository](https://github.com/anywhichway/lightview).

---

**Made with ❤️ by the Lightview team**
