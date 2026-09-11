// Semgrep rule tests for auth-ninja-dotnet.yml

using System.Security.Cryptography;

class PasswordHasherFixture
{
    void WeakPasswordHashDotnet(byte[] pw)
    {
        // ruleid: weak-password-hash-dotnet
        MD5.Create();

        // ruleid: weak-password-hash-dotnet
        SHA256.HashData(pw);
    }

    void OkPasswordHash()
    {
        // ok: weak-password-hash-dotnet
        var argon2 = new Argon2id(password);
    }
}
