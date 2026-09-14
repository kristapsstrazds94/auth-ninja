using System.Text.Json;
using AuthNinja.AspNetCore.Data.Entities;
using AuthNinja.AspNetCore.Data.Enums;
using AuthNinja.AspNetCore.Data.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace AuthNinja.AspNetCore.Data;

public sealed class AuthNinjaDbContext : DbContext
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public AuthNinjaDbContext(DbContextOptions<AuthNinjaDbContext> options)
        : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();

    public DbSet<Session> Sessions => Set<Session>();

    public DbSet<Credential> Credentials => Set<Credential>();

    public DbSet<AuditEvent> AuditEvents => Set<AuditEvent>();

    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        ArgumentNullException.ThrowIfNull(modelBuilder);

        ConfigureUsers(modelBuilder.Entity<User>());
        ConfigurePasswordResetTokens(modelBuilder.Entity<PasswordResetToken>());
        ConfigureSessions(modelBuilder.Entity<Session>());
        ConfigureCredentials(modelBuilder.Entity<Credential>());
        ConfigureAuditEvents(modelBuilder.Entity<AuditEvent>());
    }

    private static void ConfigureUsers(EntityTypeBuilder<User> entity)
    {
        entity.ToTable("users");

        entity.HasKey(e => e.Id);
        entity.Property(e => e.Id)
            .HasColumnName("id")
            .HasDefaultValueSql("gen_random_uuid()");

        entity.Property(e => e.Email).HasColumnName("email").IsRequired();
        entity.Property(e => e.EmailNormalized).HasColumnName("email_normalized").IsRequired();
        entity.Property(e => e.PasswordHash).HasColumnName("password_hash").IsRequired();
        entity.Property(e => e.TotpSecret).HasColumnName("totp_secret");
        entity.Property(e => e.MfaEnabled)
            .HasColumnName("mfa_enabled")
            .HasDefaultValue(false)
            .IsRequired();
        entity.Property(e => e.CreatedAt)
            .HasColumnName("created_at")
            .HasDefaultValueSql("now()")
            .IsRequired();
        entity.Property(e => e.UpdatedAt)
            .HasColumnName("updated_at")
            .HasDefaultValueSql("now()")
            .IsRequired();

        entity.HasIndex(e => e.EmailNormalized)
            .IsUnique()
            .HasDatabaseName("users_email_normalized_uidx");
        entity.HasIndex(e => e.Email).HasDatabaseName("users_email_idx");
    }

    private static void ConfigurePasswordResetTokens(EntityTypeBuilder<PasswordResetToken> entity)
    {
        entity.ToTable("password_reset_tokens");

        entity.HasKey(e => e.Id);
        entity.Property(e => e.Id)
            .HasColumnName("id")
            .HasDefaultValueSql("gen_random_uuid()");

        entity.Property(e => e.UserId).HasColumnName("user_id").IsRequired();
        entity.Property(e => e.TokenHash).HasColumnName("token_hash").IsRequired();
        entity.Property(e => e.ExpiresAt).HasColumnName("expires_at").IsRequired();
        entity.Property(e => e.CreatedAt)
            .HasColumnName("created_at")
            .HasDefaultValueSql("now()")
            .IsRequired();

        entity.HasOne(e => e.User)
            .WithMany()
            .HasForeignKey(e => e.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        entity.HasIndex(e => e.TokenHash)
            .IsUnique()
            .HasDatabaseName("password_reset_tokens_token_hash_uidx");
        entity.HasIndex(e => e.UserId).HasDatabaseName("password_reset_tokens_user_id_idx");
        entity.HasIndex(e => e.ExpiresAt).HasDatabaseName("password_reset_tokens_expires_at_idx");
    }

    private static void ConfigureSessions(EntityTypeBuilder<Session> entity)
    {
        entity.ToTable("sessions");

        entity.HasKey(e => e.Id);
        entity.Property(e => e.Id)
            .HasColumnName("id")
            .HasDefaultValueSql("gen_random_uuid()");

        entity.Property(e => e.TokenHash).HasColumnName("token_hash").IsRequired();
        entity.Property(e => e.UserId).HasColumnName("user_id").IsRequired();
        entity.Property(e => e.CreatedAt)
            .HasColumnName("created_at")
            .HasDefaultValueSql("now()")
            .IsRequired();
        entity.Property(e => e.LastSeenAt)
            .HasColumnName("last_seen_at")
            .HasDefaultValueSql("now()")
            .IsRequired();
        entity.Property(e => e.ExpiresAt).HasColumnName("expires_at").IsRequired();
        entity.Property(e => e.IpAddress).HasColumnName("ip_address");
        entity.Property(e => e.UserAgent).HasColumnName("user_agent");

        entity.HasOne(e => e.User)
            .WithMany(u => u.Sessions)
            .HasForeignKey(e => e.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        entity.HasIndex(e => e.TokenHash)
            .IsUnique()
            .HasDatabaseName("sessions_token_hash_uidx");
        entity.HasIndex(e => e.UserId).HasDatabaseName("sessions_user_id_idx");
        entity.HasIndex(e => e.ExpiresAt).HasDatabaseName("sessions_expires_at_idx");
    }

    private static void ConfigureCredentials(EntityTypeBuilder<Credential> entity)
    {
        entity.ToTable("credentials");

        entity.HasKey(e => e.Id);
        entity.Property(e => e.Id)
            .HasColumnName("id")
            .HasDefaultValueSql("gen_random_uuid()");

        entity.Property(e => e.UserId).HasColumnName("user_id").IsRequired();
        entity.Property(e => e.Type)
            .HasColumnName("type")
            .HasColumnType("credential_type")
            .IsRequired();
        entity.Property(e => e.CredentialId).HasColumnName("credential_id");
        entity.Property(e => e.PublicKey).HasColumnName("public_key");
        entity.Property(e => e.Counter).HasColumnName("counter");
        entity.Property(e => e.Nickname).HasColumnName("nickname");
        entity.Property(e => e.Transports).HasColumnName("transports");
        entity.Property(e => e.CodeHash).HasColumnName("code_hash");
        entity.Property(e => e.ConsumedAt).HasColumnName("consumed_at");
        entity.Property(e => e.CreatedAt)
            .HasColumnName("created_at")
            .HasDefaultValueSql("now()")
            .IsRequired();
        entity.Property(e => e.LastUsedAt).HasColumnName("last_used_at");

        entity.HasOne(e => e.User)
            .WithMany(u => u.Credentials)
            .HasForeignKey(e => e.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        entity.HasIndex(e => e.CredentialId)
            .IsUnique()
            .HasFilter("credential_id IS NOT NULL")
            .HasDatabaseName("credentials_credential_id_uidx");
        entity.HasIndex(e => e.UserId).HasDatabaseName("credentials_user_id_idx");
        entity.HasIndex(e => new { e.UserId, e.Type }).HasDatabaseName("credentials_user_id_type_idx");
    }

    private static void ConfigureAuditEvents(EntityTypeBuilder<AuditEvent> entity)
    {
        entity.ToTable("audit_events");

        entity.HasKey(e => e.Id);
        entity.Property(e => e.Id).HasColumnName("id");

        entity.Property(e => e.Type)
            .HasColumnName("type")
            .HasColumnType("audit_event_type")
            .IsRequired();
        entity.Property(e => e.OccurredAt).HasColumnName("occurred_at").IsRequired();
        entity.Property(e => e.IpAddress).HasColumnName("ip_address").IsRequired();
        entity.Property(e => e.UserAgent).HasColumnName("user_agent");
        entity.Property(e => e.UserId).HasColumnName("user_id");

        var payloadConverter = new ValueConverter<AuditEventPayload, string>(
            v => JsonSerializer.Serialize(v, JsonOptions),
            v => JsonSerializer.Deserialize<AuditEventPayload>(v, JsonOptions) ?? new AuditEventPayload());

        entity.Property(e => e.Payload)
            .HasColumnName("payload")
            .HasColumnType("jsonb")
            .HasDefaultValueSql("'{}'::jsonb")
            .HasConversion(payloadConverter)
            .IsRequired();

        entity.HasOne(e => e.User)
            .WithMany(u => u.AuditEvents)
            .HasForeignKey(e => e.UserId)
            .OnDelete(DeleteBehavior.SetNull);

        entity.HasIndex(e => e.OccurredAt).HasDatabaseName("audit_events_occurred_at_idx");
        entity.HasIndex(e => e.UserId).HasDatabaseName("audit_events_user_id_idx");
        entity.HasIndex(e => e.Type).HasDatabaseName("audit_events_type_idx");
    }
}
