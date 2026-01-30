import java.io.IOException;
import java.net.*;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

public class connnetTest {
    public static void main(String[] args) throws IOException, InterruptedException {
        String json="{\"prompt\":\"你好，这里是JAVA\"}";
        HttpClient client = HttpClient.newHttpClient();

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("http://localhost:5000/chat"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .build();

        long startTime = System.currentTimeMillis();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        long endTime = System.currentTimeMillis();

        long duration = endTime - startTime;

        System.out.println(response.body());
        System.out.println("请求用时: " + duration + " 毫秒");
    }
}
