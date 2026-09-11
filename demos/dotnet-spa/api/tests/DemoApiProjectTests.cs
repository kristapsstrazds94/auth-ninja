using Xunit;

namespace AuthNinja.DemoApi.Tests;

public sealed class DemoApiProjectTests
{
    [Fact]
    public void DemoApiAssemblyReferencesAuthNinja()
    {
        var assembly = typeof(Program).Assembly;
        var references = assembly.GetReferencedAssemblies().Select(r => r.Name);
        Assert.Contains("AuthNinja.AspNetCore", references);
    }
}
