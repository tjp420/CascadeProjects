// Simple binary-heap priority queue. Higher `priority` value dequeues first.
class PriorityQueue {
  constructor() {
    this._heap = [];
  }
  get length() { return this._heap.length; }
  push(item) {
    this._heap.push(item);
    this._siftUp(this._heap.length - 1);
  }
  shift() {
    if (this._heap.length === 0) return undefined;
    const top = this._heap[0];
    const last = this._heap.pop();
    if (this._heap.length > 0) {
      this._heap[0] = last;
      this._siftDown(0);
    }
    return top;
  }
  _compare(a, b) {
    // higher priority first; tie-breaker: earlier enqueuedAt (smaller)
    if (a.priority !== b.priority) return a.priority > b.priority;
    return a.enqueuedAt < b.enqueuedAt;
  }
  _siftUp(idx) {
    while (idx > 0) {
      const parent = Math.floor((idx - 1) / 2);
      if (this._compare(this._heap[idx], this._heap[parent])) {
        [this._heap[idx], this._heap[parent]] = [this._heap[parent], this._heap[idx]];
        idx = parent;
      } else break;
    }
  }
  _siftDown(idx) {
    const n = this._heap.length;
    while (true) {
      const left = idx * 2 + 1;
      const right = idx * 2 + 2;
      let best = idx;
      if (left < n && this._compare(this._heap[left], this._heap[best])) best = left;
      if (right < n && this._compare(this._heap[right], this._heap[best])) best = right;
      if (best !== idx) {
        [this._heap[idx], this._heap[best]] = [this._heap[best], this._heap[idx]];
        idx = best;
      } else break;
    }
  }
}

module.exports = PriorityQueue;
