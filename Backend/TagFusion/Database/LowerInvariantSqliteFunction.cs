using System.Data.SQLite;

namespace TagFusion.Database;

/// <summary>
/// Culture-invariant lowercase for SQLite queries. SQLite's built-in lower()
/// and LIKE are only case-insensitive for ASCII — German umlauts (Ä→ä) need this.
/// Kultur-invariantes Lowercase für SQLite — eingebautes lower()/LIKE kann keine Umlaute.
/// </summary>
[SQLiteFunction(Name = "lower_inv", Arguments = 1, FuncType = FunctionType.Scalar)]
public class LowerInvariantSqliteFunction : SQLiteFunction
{
    public override object Invoke(object[] args)
        => args[0] is string s ? s.ToLowerInvariant() : args[0];
}
