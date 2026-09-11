# Secure replacement patterns

Use these as review templates. They do not contain real secrets. Apply them only after you confirm the finding on disk.

## Credentials — load from the environment

Java:

```java
public final class AuthConstants {
    public static final String API_KEY = System.getenv("API_KEY");
    static {
        if (API_KEY == null || API_KEY.isBlank()) {
            throw new IllegalStateException("API_KEY is not set");
        }
    }
}
```

Node:

```javascript
const apiKey = process.env.API_KEY;
if (!apiKey) {
  throw new Error("API_KEY is not set");
}
```

## Dynamic eval — parse JSON instead

```kotlin
val element = JsonParser.parseString(rawJson)
val token = element.asJsonObject.get("token").asString
```

## Empty catch — log or rethrow

```java
try {
    initializeCoreServices(context);
} catch (Exception e) {
    logger.log(Level.SEVERE, "Core service init failed", e);
    throw e;
}
```

## Git ignore for local secrets

```gitignore
.env
.env.*
!.env.example
```
