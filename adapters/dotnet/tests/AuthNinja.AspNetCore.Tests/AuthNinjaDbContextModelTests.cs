using AuthNinja.AspNetCore.Data;
using AuthNinja.AspNetCore.Data.Entities;
using AuthNinja.AspNetCore.Data.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

namespace AuthNinja.AspNetCore.Tests;

public sealed class AuthNinjaDbContextModelTests
{
    [Fact]
    public void Model_DefinesExpectedTablesAndIndexes()
    {
        using var context = CreateContext();
        var model = context.Model;

        Assert.NotNull(model.FindEntityType(typeof(User)));
        Assert.NotNull(model.FindEntityType(typeof(Session)));
        Assert.NotNull(model.FindEntityType(typeof(Credential)));
        Assert.NotNull(model.FindEntityType(typeof(AuditEvent)));

        AssertUniqueIndex(model, typeof(User), "users_email_normalized_uidx");
        AssertIndex(model, typeof(User), "users_email_idx");
        AssertUniqueIndex(model, typeof(Session), "sessions_token_hash_uidx");
        AssertUniqueIndex(model, typeof(Credential), "credentials_credential_id_uidx");
        AssertIndex(model, typeof(AuditEvent), "audit_events_occurred_at_idx");
    }

    [Fact]
    public void Model_ConfiguresCascadeAndSetNullDeletes()
    {
        using var context = CreateContext();
        var model = context.Model;

        var sessionFk = GetForeignKey(model, typeof(Session), typeof(User));
        Assert.Equal(DeleteBehavior.Cascade, sessionFk.DeleteBehavior);

        var credentialFk = GetForeignKey(model, typeof(Credential), typeof(User));
        Assert.Equal(DeleteBehavior.Cascade, credentialFk.DeleteBehavior);

        var auditFk = GetForeignKey(model, typeof(AuditEvent), typeof(User));
        Assert.Equal(DeleteBehavior.SetNull, auditFk.DeleteBehavior);
    }

    [Fact]
    public void Model_MapsPostgresEnumColumns()
    {
        using var context = CreateContext();
        var model = context.Model;

        var auditType = model.FindEntityType(typeof(AuditEvent))!.FindProperty(nameof(AuditEvent.Type))!;
        Assert.Equal("audit_event_type", auditType.GetColumnType());

        var credentialType = model.FindEntityType(typeof(Credential))!.FindProperty(nameof(Credential.Type))!;
        Assert.Equal("credential_type", credentialType.GetColumnType());
    }

    private static AuthNinjaDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AuthNinjaDbContext>()
            .UseNpgsql("Host=localhost;Database=auth_ninja_model_test", npgsql =>
            {
                npgsql.MapEnum<AuditEventType>("audit_event_type");
                npgsql.MapEnum<CredentialType>("credential_type");
            })
            .Options;

        return new AuthNinjaDbContext(options);
    }

    private static IForeignKey GetForeignKey(IModel model, Type dependent, Type principal)
    {
        var entityType = model.FindEntityType(dependent)!;
        return entityType.GetForeignKeys().Single(fk => fk.PrincipalEntityType.ClrType == principal);
    }

    private static void AssertIndex(IModel model, Type entityType, string indexName)
    {
        var indexes = model.FindEntityType(entityType)!.GetIndexes();
        Assert.Contains(indexes, index => index.GetDatabaseName() == indexName);
    }

    private static void AssertUniqueIndex(IModel model, Type entityType, string indexName)
    {
        var index = model.FindEntityType(entityType)!.GetIndexes()
            .Single(i => i.GetDatabaseName() == indexName);
        Assert.True(index.IsUnique);
    }
}
