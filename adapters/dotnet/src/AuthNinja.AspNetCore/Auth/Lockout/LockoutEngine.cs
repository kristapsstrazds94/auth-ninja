using Microsoft.Extensions.Options;

namespace AuthNinja.AspNetCore.Auth.Lockout;

internal interface ILockoutStore
{
    Task<LockoutRecord?> GetAsync(string key, CancellationToken cancellationToken = default);

    Task SetAsync(string key, LockoutRecord record, CancellationToken cancellationToken = default);

    Task DeleteAsync(string key, CancellationToken cancellationToken = default);
}

internal sealed class InMemoryLockoutStore : ILockoutStore
{
    private readonly Dictionary<string, LockoutRecord> _records = new();

    public Task<LockoutRecord?> GetAsync(string key, CancellationToken cancellationToken = default)
    {
        if (!_records.TryGetValue(key, out var record))
        {
            return Task.FromResult<LockoutRecord?>(null);
        }

        return Task.FromResult<LockoutRecord?>(Clone(record));
    }

    public Task SetAsync(string key, LockoutRecord record, CancellationToken cancellationToken = default)
    {
        _records[key] = Clone(record);
        return Task.CompletedTask;
    }

    public Task DeleteAsync(string key, CancellationToken cancellationToken = default)
    {
        _records.Remove(key);
        return Task.CompletedTask;
    }

    private static LockoutRecord Clone(LockoutRecord record) =>
        new()
        {
            Attempts = [..record.Attempts],
            LockedUntil = record.LockedUntil,
        };
}

internal sealed class LockoutEngine
{
    private static readonly LockoutRecord EmptyRecord = new();

    private readonly AuthNinjaOptions _options;
    private readonly ILockoutStore _store;

    public LockoutEngine(IOptions<AuthNinjaOptions> options, ILockoutStore store)
    {
        _options = options.Value;
        _store = store;
    }

    public async Task AssertNotLockedAsync(string key, DateTimeOffset now, CancellationToken cancellationToken = default)
    {
        var status = await GetStatusAsync(key, now, cancellationToken);
        if (status.Locked)
        {
            throw AuthErrors.Create(AuthErrorCode.AccountLocked);
        }
    }

    public async Task<RecordFailureResult> RecordFailureAsync(
        string key,
        DateTimeOffset now,
        CancellationToken cancellationToken = default)
    {
        AssertKey(key);
        var current = await LoadRecordAsync(key, now, cancellationToken);
        var (nextRecord, result) = RecordFailedAttempt(current, now);
        await _store.SetAsync(key, nextRecord, cancellationToken);
        return result;
    }

    public async Task RecordSuccessAsync(string key, CancellationToken cancellationToken = default)
    {
        AssertKey(key);
        await _store.DeleteAsync(key, cancellationToken);
    }

    private async Task<LockoutStatus> GetStatusAsync(
        string key,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        AssertKey(key);
        var record = await LoadRecordAsync(key, now, cancellationToken);
        return Evaluate(record, now);
    }

    private async Task<LockoutRecord> LoadRecordAsync(
        string key,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var stored = await _store.GetAsync(key, cancellationToken);
        var record = stored ?? EmptyRecord;
        var pruned = Prune(record, now);

        var changed = pruned.Attempts.Count != record.Attempts.Count || pruned.LockedUntil != record.LockedUntil;
        if (changed)
        {
            if (pruned.Attempts.Count == 0 && pruned.LockedUntil is null)
            {
                await _store.DeleteAsync(key, cancellationToken);
                return EmptyRecord;
            }

            await _store.SetAsync(key, pruned, cancellationToken);
        }

        return pruned;
    }

    private LockoutRecord Prune(LockoutRecord record, DateTimeOffset now)
    {
        var nowMs = now.ToUnixTimeMilliseconds();
        var windowStart = nowMs - MinutesToMs(_options.LockoutWindowMinutes);
        var attempts = record.Attempts.Where(a => a >= windowStart).ToList();

        var lockedUntil = record.LockedUntil;
        if (lockedUntil is not null && lockedUntil <= nowMs)
        {
            lockedUntil = null;
        }

        return lockedUntil is null
            ? new LockoutRecord { Attempts = attempts }
            : new LockoutRecord { Attempts = attempts, LockedUntil = lockedUntil };
    }

    private LockoutStatus Evaluate(LockoutRecord record, DateTimeOffset now)
    {
        var pruned = Prune(record, now);
        var nowMs = now.ToUnixTimeMilliseconds();

        if (pruned.LockedUntil is not null && pruned.LockedUntil > nowMs)
        {
            return new LockoutStatus
            {
                Locked = true,
                AttemptCount = pruned.Attempts.Count,
                RemainingAttempts = 0,
                UnlockAt = DateTimeOffset.FromUnixTimeMilliseconds(pruned.LockedUntil.Value),
            };
        }

        var attemptCount = pruned.Attempts.Count;
        return new LockoutStatus
        {
            Locked = false,
            AttemptCount = attemptCount,
            RemainingAttempts = Math.Max(0, _options.LockoutMaxAttempts - attemptCount),
        };
    }

    private (LockoutRecord Record, RecordFailureResult Result) RecordFailedAttempt(
        LockoutRecord record,
        DateTimeOffset now)
    {
        var pruned = Prune(record, now);
        var nowMs = now.ToUnixTimeMilliseconds();

        if (pruned.LockedUntil is not null && pruned.LockedUntil > nowMs)
        {
            return (pruned, new RecordFailureResult
            {
                Locked = true,
                AttemptCount = pruned.Attempts.Count,
                RemainingAttempts = 0,
                UnlockAt = DateTimeOffset.FromUnixTimeMilliseconds(pruned.LockedUntil.Value),
                JustLocked = false,
            });
        }

        var attempts = pruned.Attempts.ToList();
        attempts.Add(nowMs);

        long? lockedUntil = pruned.LockedUntil;
        var justLocked = false;

        if (attempts.Count >= _options.LockoutMaxAttempts)
        {
            lockedUntil = nowMs + MinutesToMs(_options.LockoutDurationMinutes);
            justLocked = true;
        }

        var nextRecord = lockedUntil is null
            ? new LockoutRecord { Attempts = attempts }
            : new LockoutRecord { Attempts = attempts, LockedUntil = lockedUntil };

        var status = Evaluate(nextRecord, now);
        return (nextRecord, new RecordFailureResult
        {
            Locked = status.Locked,
            AttemptCount = status.AttemptCount,
            RemainingAttempts = status.RemainingAttempts,
            UnlockAt = status.UnlockAt,
            JustLocked = justLocked,
        });
    }

    private static void AssertKey(string key)
    {
        if (string.IsNullOrWhiteSpace(key))
        {
            throw AuthErrors.Create(AuthErrorCode.ValidationError);
        }
    }

    private static long MinutesToMs(int minutes) => minutes * 60_000L;
}
