using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.Extensions.Options;

namespace AuthNinja.AspNetCore;

internal sealed class ConfigureAuthNinjaCorsOptions(IOptions<AuthNinjaOptions> authOptions)
    : IConfigureOptions<CorsOptions>
{
    public void Configure(CorsOptions options)
    {
        var origins = authOptions.Value.CorsOrigins;
        if (origins is not { Length: > 0 })
        {
            return;
        }

        options.AddPolicy(
            AuthNinjaCorsPolicy.Name,
            policy => policy
                .WithOrigins(origins)
                .AllowAnyHeader()
                .AllowAnyMethod()
                .AllowCredentials());
    }
}
