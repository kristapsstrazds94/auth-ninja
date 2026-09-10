using System.Text.Json;
using AuthNinja.AspNetCore.Tests.Support;
using Microsoft.AspNetCore.TestHost;
using Testcontainers.PostgreSql;

namespace AuthNinja.AspNetCore.Tests.Contract;

public sealed class ContractTests : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .Build();

    public async Task InitializeAsync() => await _postgres.StartAsync();

    public async Task DisposeAsync() => await _postgres.DisposeAsync();

    public static IEnumerable<object[]> ScenarioFiles()
    {
        var scenariosDir = Path.Combine(AppContext.BaseDirectory, "ContractScenarios");
        foreach (var file in Directory.GetFiles(scenariosDir, "*.json").OrderBy(static f => f))
        {
            yield return [Path.GetFileName(file)];
        }
    }

    [Theory]
    [MemberData(nameof(ScenarioFiles))]
    public async Task SharedScenario_PassesAgainstDotNetAdapter(string fileName)
    {
        using var host = await AuthTestHostFactory.CreateAsync(_postgres.GetConnectionString());
        var client = host.GetTestClient();

        var scenarioPath = Path.Combine(AppContext.BaseDirectory, "ContractScenarios", fileName);
        var json = await File.ReadAllTextAsync(scenarioPath);
        var scenario = JsonSerializer.Deserialize<ContractScenario>(json)
            ?? throw new InvalidOperationException($"Failed to load scenario {fileName}.");

        var runner = new ContractScenarioRunner(client, scenario);
        await runner.RunAsync(scenario);
    }
}
