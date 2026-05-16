import { Injectable } from '@nestjs/common';
import { Counter, Gauge, Histogram, register } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly profilesViewedCounter: Counter;
  private readonly likeCounter: Counter;
  private readonly skipCounter: Counter;
  private readonly superLikeCounter: Counter;
  private readonly profileRatingGauge: Gauge;
  private readonly feedBatchDurationHistogram: Histogram;
  private readonly ratingRecalculationDurationHistogram: Histogram;
  private readonly blockCounter: Counter;
  private readonly reportCounter: Counter;

  constructor() {
    this.profilesViewedCounter = new Counter({
      name: 'profiles_viewed_total',
      help: 'Total number of profiles viewed',
      labelNames: ['action'],
    });

    this.likeCounter = new Counter({
      name: 'likes_total',
      help: 'Total number of likes',
    });

    this.skipCounter = new Counter({
      name: 'skips_total',
      help: 'Total number of skips',
    });

    this.superLikeCounter = new Counter({
      name: 'superlikes_total',
      help: 'Total number of super likes',
    });

    this.profileRatingGauge = new Gauge({
      name: 'profile_rating_score',
      help: 'Profile rating score',
      labelNames: ['profileId'],
    });

    this.feedBatchDurationHistogram = new Histogram({
      name: 'feed_batch_duration_ms',
      help: 'Duration of feed batch generation in milliseconds',
      buckets: [10, 50, 100, 500, 1000, 5000],
    });

    this.ratingRecalculationDurationHistogram = new Histogram({
      name: 'rating_recalculation_duration_ms',
      help: 'Duration of rating recalculation in milliseconds',
      buckets: [10, 50, 100, 500, 1000, 5000],
    });

    this.blockCounter = new Counter({
      name: 'blocks_total',
      help: 'Total number of user blocks',
    });

    this.reportCounter = new Counter({
      name: 'reports_total',
      help: 'Total number of user reports',
      labelNames: ['reason'],
    });
  }

  recordProfileView(action: string): void {
    this.profilesViewedCounter.labels(action).inc();
  }

  recordLike(): void {
    this.likeCounter.inc();
  }

  recordSkip(): void {
    this.skipCounter.inc();
  }

  recordSuperLike(): void {
    this.superLikeCounter.inc();
  }

  setProfileRating(profileId: string, score: number): void {
    this.profileRatingGauge.labels(profileId).set(score);
  }

  recordFeedBatchDuration(durationMs: number): void {
    this.feedBatchDurationHistogram.observe(durationMs);
  }

  recordRatingRecalculationDuration(durationMs: number): void {
    this.ratingRecalculationDurationHistogram.observe(durationMs);
  }

  recordBlock(): void {
    this.blockCounter.inc();
  }

  recordReport(reason: string): void {
    this.reportCounter.labels(reason).inc();
  }

  async getMetrics(): Promise<string> {
    return register.metrics();
  }
}
