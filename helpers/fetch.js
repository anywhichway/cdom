// Example: { p: { "=fetch": ["https://api.example.com/data"] } }
export default function (url, options = {}) {
    const fetchOptions = { ...options };
    const headers = { ...fetchOptions.headers };

    let body = fetchOptions.body;
    if (body !== undefined) {
        if (body !== null && typeof body === 'object') {
            body = JSON.stringify(body);
            if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
        } else {
            body = String(body);
            if (!headers['Content-Type']) headers['Content-Type'] = 'text/plain';
        }
    }

    fetchOptions.body = body;
    fetchOptions.headers = headers;

    return globalThis.fetch(url, fetchOptions);
}
