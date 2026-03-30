export class PriorityQueue<T> {
  private items: T[] = [];

  constructor(private readonly compare: (a: T, b: T) => number) {}

  size() {
    return this.items.length;
  }

  peek() {
    return this.items[0];
  }

  push(item: T) {
    this.items.push(item);
    this.bubbleUp(this.items.length - 1);
  }

  pop() {
    if (this.items.length === 0) {
      return undefined;
    }

    const top = this.items[0];
    const last = this.items.pop();

    if (last !== undefined && this.items.length > 0) {
      this.items[0] = last;
      this.bubbleDown(0);
    }

    return top;
  }

  clear() {
    this.items = [];
  }

  private bubbleUp(index: number) {
    let currentIndex = index;

    while (currentIndex > 0) {
      const parentIndex = Math.floor((currentIndex - 1) / 2);
      if (
        this.compare(this.items[currentIndex], this.items[parentIndex]) >= 0
      ) {
        break;
      }

      [this.items[currentIndex], this.items[parentIndex]] = [
        this.items[parentIndex],
        this.items[currentIndex],
      ];
      currentIndex = parentIndex;
    }
  }

  private bubbleDown(index: number) {
    let currentIndex = index;
    const length = this.items.length;

    while (true) {
      const left = currentIndex * 2 + 1;
      const right = currentIndex * 2 + 2;
      let smallest = currentIndex;

      if (
        left < length &&
        this.compare(this.items[left], this.items[smallest]) < 0
      ) {
        smallest = left;
      }

      if (
        right < length &&
        this.compare(this.items[right], this.items[smallest]) < 0
      ) {
        smallest = right;
      }

      if (smallest === currentIndex) {
        break;
      }

      [this.items[currentIndex], this.items[smallest]] = [
        this.items[smallest],
        this.items[currentIndex],
      ];
      currentIndex = smallest;
    }
  }
}
