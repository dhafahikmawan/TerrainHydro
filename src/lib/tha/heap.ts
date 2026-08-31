export class MinHeap<T> {
  private data: T[] = [];

  constructor(private readonly compare: (a: T, b: T) => number) {}

  get length(): number {
    return this.data.length;
  }

  push(value: T): void {
    this.data.push(value);
    let index = this.data.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.compare(this.data[index], this.data[parent]) >= 0) break;
      [this.data[index], this.data[parent]] = [this.data[parent], this.data[index]];
      index = parent;
    }
  }

  pop(): T | undefined {
    if (this.data.length === 0) return undefined;
    const result = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;
        if (left < this.data.length && this.compare(this.data[left], this.data[smallest]) < 0) smallest = left;
        if (right < this.data.length && this.compare(this.data[right], this.data[smallest]) < 0) smallest = right;
        if (smallest === index) break;
        [this.data[index], this.data[smallest]] = [this.data[smallest], this.data[index]];
        index = smallest;
      }
    }
    return result;
  }
}