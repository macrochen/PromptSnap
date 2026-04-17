const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

class Element {
    constructor(tagName, id = '') {
        this.tagName = tagName.toUpperCase();
        this.id = id;
        this.children = [];
        this.parentNode = null;
        this.style = {};
        this.dataset = {};
        this.listeners = {};
        this.value = '';
        this.textContent = '';
        this.innerHTMLValue = '';
        this.classNames = new Set();
        this.classList = {
            add: (...names) => names.forEach(name => this.classNames.add(name))
        };
    }

    set innerHTML(value) {
        this.innerHTMLValue = value;
        if (value === '') {
            this.children = [];
        }
    }

    get innerHTML() {
        return this.innerHTMLValue;
    }

    appendChild(child) {
        child.parentNode = this;
        this.children.push(child);
        return child;
    }

    replaceChild(newChild, oldChild) {
        const index = this.children.indexOf(oldChild);
        if (index !== -1) {
            newChild.parentNode = this;
            oldChild.parentNode = null;
            this.children[index] = newChild;
        }
        return oldChild;
    }

    addEventListener(type, listener) {
        this.listeners[type] = listener;
    }

    focus() {
        this.focused = true;
    }

    select() {
        this.selected = true;
    }

    cloneNode() {
        const clone = new Element(this.tagName, this.id);
        clone.textContent = this.textContent;
        clone.value = this.value;
        return clone;
    }

    querySelectorAll(selector) {
        const results = [];
        const visit = (node) => {
            if (selector.startsWith('.') && node.classNames.has(selector.slice(1))) {
                results.push(node);
            }
            node.children.forEach(visit);
        };
        this.children.forEach(visit);
        return results;
    }
}

function createDocument() {
    const elements = new Map();
    const ensure = (id, tag = 'div') => {
        if (!elements.has(id)) {
            elements.set(id, new Element(tag, id));
        }
        return elements.get(id);
    };

    const header = new Element('div');
    header.classNames.add('header');
    ensure('tags-bar');
    ensure('list');
    ensure('variable-modal');
    ensure('variable-inputs');
    const select = ensure('select-target-site', 'select');
    const siteWrapper = new Element('div');
    siteWrapper.appendChild(select);
    const actions = new Element('div');
    const confirm = ensure('btn-var-confirm', 'button');
    actions.appendChild(confirm);

    return {
        createElement: (tagName) => new Element(tagName),
        querySelector: (selector) => selector === '.header' ? header : null,
        getElementById: (id) => ensure(id),
        addEventListener: () => {},
        elements
    };
}

const document = createDocument();
const context = {
    document,
    console,
    setTimeout: (fn) => fn(),
    chrome: { storage: { local: { get: () => {} } } }
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'popup', 'popup.js'), 'utf8'), context);

const prompt = { content: '{{问题列表:第一行\n第二行}}' };
const matches = [...prompt.content.matchAll(/{{\s*([\s\S]*?)\s*}}/g)];
context.showVariableInput(prompt, matches, { showSiteSelector: false }, () => {});

const controls = document.getElementById('variable-inputs').querySelectorAll('.var-input');
assert.strictEqual(controls.length, 1);
assert.strictEqual(controls[0].tagName, 'TEXTAREA');
assert.strictEqual(controls[0].value, '第一行\n第二行');
