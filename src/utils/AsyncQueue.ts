interface PendingJob<T> {
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

export class AsyncQueue {
  private active = 0;
  private readonly pending: PendingJob<unknown>[] = [];

  constructor(private readonly concurrency: number) {
    if (!Number.isInteger(concurrency) || concurrency < 1) {
      throw new Error("AsyncQueue concurrency must be a positive integer.");
    }
  }

  add<T>(run: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.pending.push({
        run,
        resolve: (value) => resolve(value as T),
        reject,
      });
      this.pump();
    });
  }

  private pump(): void {
    while (this.active < this.concurrency) {
      const job = this.pending.shift();
      if (!job) return;
      this.active += 1;
      void job.run()
        .then(job.resolve, job.reject)
        .finally(() => {
          this.active -= 1;
          this.pump();
        });
    }
  }
}
