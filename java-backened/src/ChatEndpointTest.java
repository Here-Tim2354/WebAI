package src;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;

public class ChatEndpointTest {
    public static void main(String[] args) throws Exception {
        String baseUrl = "http://127.0.0.1:5000/chat";

        String model = "gemini-3-flash-preview";
        String userInput = "英伟达最新股票是多少？";

        String customApiKey = "hajimi";
        String customBaseUrl = "https://gemini.ystone.top";
        String settings = """
                {
                    "gemini_api_key": "%s",
                    "gemini_base_url": "%s"
                }
                """.formatted(escapeJson(customApiKey), escapeJson(customBaseUrl));

        String config = """
                {
                    "thinking_config": {
                        "include_thoughts": true,
                        "thinking_level": "high"
                    },
                    "system_instruction": "%s",
                    "tools": {
                        "enable_google_search": true,
                        "enable_url_context": true
                    }
                }
                """.formatted(escapeJson(SystemPromptProvider.getSystemInstruction()));

        String jsonBody = """
                {
                    "model": "%s",
                    "user_input": "%s",
                    "custom_settings": %s,
                    "config": %s
                }
                """.formatted(escapeJson(model), escapeJson(userInput), settings, config);

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(baseUrl))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(jsonBody, StandardCharsets.UTF_8))
            .build();

        HttpClient client = HttpClient.newHttpClient();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

        System.out.println("Status: " + response.statusCode());
        System.out.println(prettyJson(response.body()));
    }

    private static String prettyJson(String json) {
        StringBuilder out = new StringBuilder();
        int indent = 0;
        boolean inString = false;
        for (int i = 0; i < json.length(); i++) {
            char c = json.charAt(i);
            if (c == '"' && (i == 0 || json.charAt(i - 1) != '\\')) {
                inString = !inString;
                out.append(c);
                continue;
            }
            if (inString) {
                out.append(c);
                continue;
            }
            switch (c) {
                case '{':
                case '[':
                    out.append(c).append('\n');
                    indent++;
                    appendIndent(out, indent);
                    break;
                case '}':
                case ']':
                    out.append('\n');
                    indent--;
                    appendIndent(out, indent);
                    out.append(c);
                    break;
                case ',':
                    out.append(c).append('\n');
                    appendIndent(out, indent);
                    break;
                case ':':
                    out.append(": ");
                    break;
                default:
                    if (!Character.isWhitespace(c)) {
                        out.append(c);
                    }
            }
        }
        return out.toString();
    }

    private static void appendIndent(StringBuilder out, int indent) {
        for (int i = 0; i < indent; i++) {
            out.append("  ");
        }
    }

    private static String escapeJson(String value) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '\\': sb.append("\\\\"); break;
                case '"': sb.append("\\\""); break;
                case '\n': sb.append("\\n"); break;
                case '\r': sb.append("\\r"); break;
                case '\t': sb.append("\\t"); break;
                default: sb.append(c);
            }
        }
        return sb.toString();
    }
}
