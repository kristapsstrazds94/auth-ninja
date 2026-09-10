namespace AuthNinja.AspNetCore.Middleware;

internal sealed class InMemoryRateLimiter
{
    private readonly Dictionary<string, Bucket> _buckets = new();

    public RateLimitResult Check(string key, int limit, int windowMs, long nowMs)
    {
        if (!_buckets.TryGetValue(key, out var bucket) || nowMs - bucket.WindowStartMs >= windowMs)
        {
            _buckets[key] = new Bucket(1, nowMs);
            return new RateLimitResult(Allowed: true);
        }

        if (bucket.Count >= limit)
        {
            var retryAfterMs = windowMs - (nowMs - bucket.WindowStartMs);
            return new RateLimitResult(
                Allowed: false,
                RetryAfterSeconds: Math.Max(1, (int)Math.Ceiling(retryAfterMs / 1000.0)));
        }

        bucket.Count += 1;
        return new RateLimitResult(Allowed: true);
    }

    public void Reset() => _buckets.Clear();

    private sealed class Bucket(int count, long windowStartMs)
    {
        public int Count { get; set; } = count;

        public long WindowStartMs { get; set; } = windowStartMs;
    }
}

internal readonly record struct RateLimitResult(bool Allowed, int? RetryAfterSeconds = null);
