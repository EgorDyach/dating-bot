import { Injectable } from '@nestjs/common';

@Injectable()
export class MetricsService {
  private metrics: Record<string, {
    cache_hits: number;
    cache_misses: number;
    db_reads: number;
    db_writes: number;
  }> = {
    lazy: { cache_hits: 0, cache_misses: 0, db_reads: 0, db_writes: 0 },
    'write-through': { cache_hits: 0, cache_misses: 0, db_reads: 0, db_writes: 0 },
    'write-back': { cache_hits: 0, cache_misses: 0, db_reads: 0, db_writes: 0 },
  };

  recordCacheHit(strategy: string) {
    if (this.metrics[strategy]) {
      this.metrics[strategy].cache_hits++;
    }
  }

  recordCacheMiss(strategy: string) {
    if (this.metrics[strategy]) {
      this.metrics[strategy].cache_misses++;
    }
  }

  recordDbRead(strategy: string) {
    if (this.metrics[strategy]) {
      this.metrics[strategy].db_reads++;
    }
  }

  recordDbWrite(strategy: string) {
    if (this.metrics[strategy]) {
      this.metrics[strategy].db_writes++;
    }
  }

  getMetrics(strategy: string) {
    const m = this.metrics[strategy];
    if (!m) return null;

    const total = m.cache_hits + m.cache_misses;
    const hitRate = total > 0 ? (m.cache_hits / total * 100).toFixed(2) : '0.00';

    return {
      strategy,
      cache_hits: m.cache_hits,
      cache_misses: m.cache_misses,
      hit_rate: `${hitRate}%`,
      db_reads: m.db_reads,
      db_writes: m.db_writes,
      total_db_calls: m.db_reads + m.db_writes,
    };
  }

  getAllMetrics() {
    return {
      lazy: this.getMetrics('lazy'),
      'write-through': this.getMetrics('write-through'),
      'write-back': this.getMetrics('write-back'),
    };
  }

  reset(strategy?: string) {
    if (strategy) {
      this.metrics[strategy] = { cache_hits: 0, cache_misses: 0, db_reads: 0, db_writes: 0 };
    } else {
      Object.keys(this.metrics).forEach(key => {
        this.metrics[key] = { cache_hits: 0, cache_misses: 0, db_reads: 0, db_writes: 0 };
      });
    }
  }
}
