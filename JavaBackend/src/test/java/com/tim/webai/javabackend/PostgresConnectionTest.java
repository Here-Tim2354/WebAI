package com.tim.webai.javabackend;

import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;

import static org.junit.jupiter.api.Assertions.assertTrue;

class PostgresConnectionTest {

    @Test
    void canConnectToTestDatabaseAndReadTestTable() throws Exception {
        String url = "jdbc:postgresql://localhost:5432/webai_db";
        String username = "postgres";
        String password = "bbb2523071971";

        try (Connection connection = DriverManager.getConnection(url, username, password);
             Statement statement = connection.createStatement();
             ResultSet resultSet = statement.executeQuery("select count(*) from test.test_table")) {

            assertTrue(resultSet.next(), "Query executed but returned no result");
        }
    }
}
