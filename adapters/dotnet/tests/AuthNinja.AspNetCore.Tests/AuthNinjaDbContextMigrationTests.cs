using AuthNinja.AspNetCore.Data;
using AuthNinja.AspNetCore.Data.Entities;
using AuthNinja.AspNetCore.Data.Enums;
using AuthNinja.AspNetCore.Data.Models;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;

namespace AuthNinja.AspNetCore.Tests;

public sealed class AuthNinjaDbContextMigrationTests : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .Build();

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();
    }

    public async Task DisposeAsync()
    {
        await _postgres.DisposeAsync();
    }

    [Fact]
    public async Task MigrateAsync_CreatesAuthTables()
    {
        await using var context = await CreateMigratedContextAsync();

        var tableNames = await context.Database
            .SqlQueryRaw<string>(
                "SELECT tablename AS \"Value\" FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename")
            .ToListAsync();

        Assert.Contains("users", tableNames);
        Assert.Contains("sessions", tableNames);
        Assert.Contains("credentials", tableNames);
        Assert.Contains("audit_events", tableNames);
    }

    [Fact]
    public async Task MigrateAsync_PersistsUserSessionCredentialAndAuditRow()
    {
        await using var context = await CreateMigratedContextAsync();
        var userId = Guid.NewGuid();
        var expiresAt = DateTimeOffset.UtcNow.AddHours(8);

        context.Users.Add(new User
        {
            Id = userId,
            Email = "user@test.local",
            EmailNormalized = "user@test.local",
            PasswordHash = "$argon2id$v=19$m=65536,t=3,p=4$fake$fake",
        });

        context.Sessions.Add(new Session
        {
            TokenHash = new string('a', 64),
            UserId = userId,
            ExpiresAt = expiresAt,
            IpAddress = "127.0.0.1",
            UserAgent = "xunit",
        });

        context.Credentials.Add(new Credential
        {
            UserId = userId,
            Type = CredentialType.Passkey,
            CredentialId = "cred-abc123",
            PublicKey = "cGJr",
            Counter = 0,
            Nickname = "Laptop",
        });

        var auditId = Guid.NewGuid();
        context.AuditEvents.Add(new AuditEvent
        {
            Id = auditId,
            Type = AuditEventType.Login,
            OccurredAt = DateTimeOffset.UtcNow,
            IpAddress = "127.0.0.1",
            UserId = userId,
            Payload = new AuditEventPayload { Outcome = "success" },
        });

        await context.SaveChangesAsync();

        var storedUser = await context.Users.SingleAsync(u => u.Id == userId);
        Assert.Equal("user@test.local", storedUser.Email);
        Assert.False(storedUser.MfaEnabled);

        Assert.Single(await context.Sessions.Where(s => s.UserId == userId).ToListAsync());
        Assert.Equal(CredentialType.Passkey, (await context.Credentials.SingleAsync(c => c.UserId == userId)).Type);

        var storedAudit = await context.AuditEvents.SingleAsync(a => a.Id == auditId);
        Assert.Equal("success", storedAudit.Payload.Outcome);
    }

    [Fact]
    public async Task MigrateAsync_RejectsDuplicateNormalizedEmail()
    {
        await using var context = await CreateMigratedContextAsync();

        context.Users.Add(new User
        {
            Email = "dup@test.local",
            EmailNormalized = "dup@test.local",
            PasswordHash = "$argon2id$v=19$m=65536,t=3,p=4$fake$fake",
        });
        await context.SaveChangesAsync();

        context.Users.Add(new User
        {
            Email = "DUP@test.local",
            EmailNormalized = "dup@test.local",
            PasswordHash = "$argon2id$v=19$m=65536,t=3,p=4$fake$fake",
        });

        await Assert.ThrowsAsync<DbUpdateException>(() => context.SaveChangesAsync());
    }

    [Fact]
    public async Task MigrateAsync_CascadesDeleteFromUsersToSessionsAndCredentials()
    {
        await using var context = await CreateMigratedContextAsync();
        var userId = Guid.NewGuid();

        context.Users.Add(new User
        {
            Id = userId,
            Email = "delete@test.local",
            EmailNormalized = "delete@test.local",
            PasswordHash = "$argon2id$v=19$m=65536,t=3,p=4$fake$fake",
        });

        context.Sessions.Add(new Session
        {
            TokenHash = new string('b', 64),
            UserId = userId,
            ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(1),
        });

        context.Credentials.Add(new Credential
        {
            UserId = userId,
            Type = CredentialType.TotpBackup,
            CodeHash = "$argon2id$v=19$m=65536,t=3,p=4$fake$fake",
        });

        await context.SaveChangesAsync();

        context.Users.Remove(await context.Users.SingleAsync(u => u.Id == userId));
        await context.SaveChangesAsync();

        Assert.Empty(await context.Sessions.Where(s => s.UserId == userId).ToListAsync());
        Assert.Empty(await context.Credentials.Where(c => c.UserId == userId).ToListAsync());
    }

    private async Task<AuthNinjaDbContext> CreateMigratedContextAsync()
    {
        var options = new DbContextOptionsBuilder<AuthNinjaDbContext>()
            .UseNpgsql(_postgres.GetConnectionString(), npgsql =>
            {
                npgsql.MigrationsAssembly(typeof(AuthNinjaDbContext).Assembly.GetName().Name);
                npgsql.MapEnum<AuditEventType>("audit_event_type");
                npgsql.MapEnum<CredentialType>("credential_type");
            })
            .Options;

        var context = new AuthNinjaDbContext(options);
        await context.Database.MigrateAsync();
        return context;
    }
}
