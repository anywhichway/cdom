export default function parseLiteral(text) {
    let at = 0;
    const ch = () => text.charAt(at);
    const next = () => text.charAt(++at);
    const skipWhitespace = () => {
        while (at < text.length && /\s/.test(ch())) at++;
    };

    const parseValue = () => {
        skipWhitespace();
        const c = ch();
        if (c === '{') return parseObject();
        if (c === '[') return parseArray();
        if (c === '"' || c === "'") return parseString();
        if (c === '-' || (c >= '0' && c <= '9')) return parseNumber();
        return parseWord();
    };

    const parseObject = () => {
        const obj = {};
        next(); // skip '{'
        skipWhitespace();
        if (ch() === '}') {
            next();
            return obj;
        }
        while (at < text.length) {
            skipWhitespace();
            let key;
            const c = ch();
            if (c === '"' || c === "'") key = parseString();
            else key = parseWord(true); // true = isKey

            skipWhitespace();
            if (ch() !== ':') throw new Error(`Expected ':' after key "${key}" at pos ${at}`);
            next(); // skip ':'

            obj[key] = parseValue();

            skipWhitespace();
            if (ch() === '}') {
                next();
                return obj;
            }
            if (ch() !== ',') throw new Error(`Expected ',' or '}' at pos ${at}`);
            next(); // skip ','
        }
        throw new Error("Unterminated object");
    };

    const parseArray = () => {
        const arr = [];
        next(); // skip '['
        skipWhitespace();
        if (ch() === ']') {
            next();
            return arr;
        }
        while (at < text.length) {
            arr.push(parseValue());
            skipWhitespace();
            if (ch() === ']') {
                next();
                return arr;
            }
            if (ch() !== ',') throw new Error(`Expected ',' or ']' at pos ${at}`);
            next(); // skip ','
        }
        throw new Error("Unterminated array");
    };

    const parseString = () => {
        const quote = ch();
        let str = '';
        while (next()) { // skip quote and move
            const c = ch();
            if (c === quote) {
                next(); // move past closing quote
                return str;
            }
            if (c === '\\') { // handle escape
                const esc = next();
                if (esc === 'n') str += '\n';
                else if (esc === 'r') str += '\r';
                else if (esc === 't') str += '\t';
                else if (esc === 'b') str += '\b';
                else if (esc === 'f') str += '\f';
                else if (esc === 'u') {
                    // Check for hex unicode \uXXXX
                    const hex = text.substr(at + 1, 4);
                    if (/^[0-9a-fA-F]{4}$/.test(hex)) {
                        str += String.fromCharCode(parseInt(hex, 16));
                        at += 4;
                    } else {
                        throw new Error(`Invalid unicode escape sequence at pos ${at}`);
                    }
                }
                else str += esc;
            } else {
                str += c;
            }
        }
        throw new Error("Unterminated string");
    };

    const parseNumber = () => {
        let str = '';
        if (ch() === '-') {
            str += '-';
            next();
        }
        while (at < text.length && /[0-9]/.test(ch())) {
            str += ch();
            next();
        }
        if (ch() === '.') {
            str += '.';
            next();
            while (at < text.length && /[0-9]/.test(ch())) {
                str += ch();
                next();
            }
        }
        const num = Number(str);
        if (isNaN(num)) throw new Error(`Invalid number at pos ${at}`);
        return num;
    };

    const parseWord = (isKey = false) => {
        let str = '';
        // Allow typical identifier chars: letters, _, $ (conceptually), numbers
        while (at < text.length && /[a-zA-Z0-9_$]/.test(ch())) {
            str += ch();
            next();
        }
        if (!isKey) {
            if (str === 'true') return true;
            if (str === 'false') return false;
            if (str === 'null') return null;
            throw new Error(`Unexpected token "${str}" at pos ${at}`);
        }
        return str;
    };

    return parseValue();
}
