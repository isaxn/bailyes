"use strict";

class Handler {
  constructor(prefix = ["!", "."]) {
    this.prefix = Array.isArray(prefix) ? prefix : [prefix];
    this.commands = new Map();
    this.hears = [];
  }

  command(name, fn) {
    const names = Array.isArray(name) ? name : [name];
    for (const n of names) this.commands.set(n, fn);
    return this;
  }

  hear(pattern, fn) {
    this.hears.push({ pattern, fn });
    return this;
  }

  matchPrefix(text) {
    for (const p of this.prefix) {
      if (text.startsWith(p)) return p;
    }
    return null;
  }

  async handle(ctx) {
    const text = (ctx.text || "").trim();
    if (!text) return;

    const prefix = this.matchPrefix(text);

    if (prefix !== null) {
      const [cmd, ...args] = text.slice(prefix.length).trim().split(/\s+/);
      const key = (cmd || "").toLowerCase();

      if (this.commands.has(key)) {
        ctx.command = key;
        ctx.args = args;
        ctx.text = args.join(" ");
        return this.commands.get(key)(ctx);
      }
    }

    for (const h of this.hears) {
      const isString = typeof h.pattern === "string" && text === h.pattern;
      const isRegex = h.pattern instanceof RegExp && h.pattern.test(text);

      if (isString || isRegex) {
        return h.fn(ctx);
      }
    }
  }
}

module.exports = { Handler };
