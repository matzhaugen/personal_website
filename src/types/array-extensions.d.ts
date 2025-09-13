declare global {
  interface Array<T> {
    contains(element: T): boolean;
    remove(element: T): T[];
  }
}

export {};
