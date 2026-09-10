using NpgsqlTypes;

namespace AuthNinja.AspNetCore.Data.Enums;

/// <summary>Matches PostgreSQL <c>audit_event_type</c> and <c>@auth-ninja/core</c> audit families.</summary>
public enum AuditEventType
{
    [PgName("login")]
    Login,

    [PgName("logout")]
    Logout,

    [PgName("lockout")]
    Lockout,

    [PgName("ip")]
    Ip,
}
