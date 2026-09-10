namespace AuthNinja.AspNetCore.Auth.Lockout;

internal sealed class LockoutRecord
{
    public List<long> Attempts { get; set; } = [];

    public long? LockedUntil { get; set; }
}

internal class LockoutStatus
{
    public bool Locked { get; init; }

    public int AttemptCount { get; init; }

    public int RemainingAttempts { get; init; }

    public DateTimeOffset? UnlockAt { get; init; }
}

internal sealed class RecordFailureResult : LockoutStatus
{
    public bool JustLocked { get; init; }
}
