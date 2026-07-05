namespace TagFusion.Database;

/// <summary>
/// Converts float[] embeddings to/from the BLOB format stored in SQLite
/// (float32 array, platform endianness — the DB never leaves this machine's format family).
/// Konvertiert Embeddings zwischen float[] und dem SQLite-BLOB-Format.
/// </summary>
public static class EmbeddingConverter
{
    public static byte[] ToBytes(float[] embedding)
    {
        var bytes = new byte[embedding.Length * sizeof(float)];
        Buffer.BlockCopy(embedding, 0, bytes, 0, bytes.Length);
        return bytes;
    }

    public static float[] ToFloats(byte[] bytes)
    {
        var floats = new float[bytes.Length / sizeof(float)];
        Buffer.BlockCopy(bytes, 0, floats, 0, bytes.Length);
        return floats;
    }
}
