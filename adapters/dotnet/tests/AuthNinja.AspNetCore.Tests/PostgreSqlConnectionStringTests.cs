using AuthNinja.AspNetCore;

namespace AuthNinja.AspNetCore.Tests;

public sealed class PostgreSqlConnectionStringTests
{
    [Fact]
    public void Normalize_ConvertsPostgresqlUriToNpgsqlFormat()
    {
        var normalized = PostgreSqlConnectionString.Normalize(
            "postgresql://auth_ninja:auth_ninja@localhost:32956/auth_ninja_e2e");

        Assert.Contains("Host=localhost", normalized);
        Assert.Contains("Port=32956", normalized);
        Assert.Contains("Database=auth_ninja_e2e", normalized);
        Assert.Contains("Username=auth_ninja", normalized);
        Assert.Contains("Password=auth_ninja", normalized);
    }

    [Fact]
    public void Normalize_PreservesKeyValueConnectionString()
    {
        const string keyValue = "Host=localhost;Port=5432;Database=auth_ninja;Username=postgres;Password=secret";
        Assert.Equal(keyValue, PostgreSqlConnectionString.Normalize(keyValue));
    }
}
