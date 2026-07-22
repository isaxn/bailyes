"use strict";

class Events {
  constructor() {
    this.events = {};
  }

  on(event, fn) {
    (this.events[event] ||= []).push(fn);
    return this;
  }

  off(event, fn) {
    if (!this.events[event]) return this;
    this.events[event] = this.events[event].filter((listener) => listener !== fn);
    return this;
  }

  emit(event, data) {
    for (const fn of this.events[event] || []) {
      fn(data);
    }
    return this;
  }
}

module.exports = { Events };
