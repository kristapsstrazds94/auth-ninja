using NpgsqlTypes;

namespace AuthNinja.AspNetCore.Data.Enums;

/// <summary>Matches PostgreSQL <c>credential_type</c>.</summary>
public enum CredentialType
{
    [PgName("passkey")]
    Passkey,

    [PgName("totp_backup")]
    TotpBackup,
}
